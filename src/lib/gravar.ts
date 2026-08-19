// =====================================================================
// Motor de gravacao.
//
// Todo insert e todo update de cadastro passam por aqui. Concentrar isso
// num lugar so tem tres consequencias que interessam:
//
//   1. A validacao roda no servidor. O `required` e o `max` do HTML sao
//      dica de interface, nao controle: quem manda o POST escolhe o que
//      envia. O que vale e o que esta na especificacao.
//   2. Nenhuma coluna entra no SQL sem estar descrita. O corpo da
//      requisicao nao decide quais campos gravar — a especificacao decide.
//   3. A auditoria e escrita na mesma transacao da alteracao. Se o
//      registro mudou, existe linha de auditoria; se a auditoria falhar,
//      a alteracao volta atras.
// =====================================================================
import { um, todos, executar, inserirRetornandoId, transacao, type Params } from './db'
import { gerarHash } from './auth'
import type { Sessao } from './sessao'
import type { Especificacao, Campo } from './registros'

/** Coluna correspondente ao campo (senha grava em senha_hash, por exemplo). */
const colunaDe = (c: Campo) => c.coluna ?? c.nome

export type Valores = Record<string, string | number | null>
export type Erros = Record<string, string>

export type Resultado =
  | { ok: true; id: number }
  | { ok: false; erros: Erros; valores: Valores }

/* ------------------------------------------------------------ normalizacao */

const so = (v: unknown) => String(v ?? '').trim()

/** Digitos de um documento, sem pontuacao. */
const digitos = (v: string) => v.replace(/\D+/g, '')

function formatarCnpj(bruto: string): string {
  const d = digitos(bruto)
  if (d.length !== 14) return bruto.trim()
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/**
 * Numero digitado em pt-BR.
 *
 * "1.234,56" tem ponto de milhar e virgula decimal; "1234.56" vem de teclado
 * numerico. Tratar os dois evita o erro silencioso de gravar 123456 no lugar
 * de 1234,56 — que numa cotacao vira uma diferenca de cem vezes.
 */
function numeroBr(bruto: string): number | null {
  const t = so(bruto)
  if (!t) return null
  const temVirgula = t.includes(',')
  const limpo = temVirgula ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

/* -------------------------------------------------------------- validacao */

function validarCampo(c: Campo, bruto: string): { valor: string | number | null; erro?: string } {
  const t = so(bruto)

  switch (c.tipo) {
    case 'booleano':
      return { valor: t === '1' || t === 'on' || t === 'true' ? 1 : 0 }

    case 'inteiro':
    case 'decimal':
    case 'moeda': {
      if (!t) {
        return c.obrigatorio ? { valor: null, erro: 'Informe um valor.' } : { valor: null }
      }
      const n = numeroBr(t)
      if (n === null) return { valor: null, erro: 'Número inválido.' }
      const v = c.tipo === 'inteiro' ? Math.round(n) : n
      if (c.min !== undefined && v < c.min) return { valor: null, erro: `Mínimo ${c.min}.` }
      if (c.max !== undefined && v > c.max) return { valor: null, erro: `Máximo ${c.max}.` }
      return { valor: v }
    }

    case 'select': {
      if (!t) return c.obrigatorio ? { valor: null, erro: 'Selecione uma opção.' } : { valor: null }
      const aceita = (c.opcoes ?? []).some((o) => o.valor === t)
      // Lista fechada: valor fora dela e recusado, nao "corrigido". Aceitar o
      // que veio quebraria o check constraint do banco mais adiante.
      return aceita ? { valor: t } : { valor: null, erro: 'Opção inválida.' }
    }

    case 'referencia': {
      if (!t) return c.obrigatorio ? { valor: null, erro: 'Selecione uma opção.' } : { valor: null }
      const n = Number(t)
      if (!Number.isInteger(n) || n <= 0) return { valor: null, erro: 'Referência inválida.' }
      return { valor: n }
    }

    case 'email': {
      if (!t) return c.obrigatorio ? { valor: null, erro: 'Informe o e-mail.' } : { valor: null }
      if (!EMAIL_RE.test(t)) return { valor: null, erro: 'E-mail inválido.' }
      return { valor: t.toLowerCase().slice(0, c.maxLen ?? 120) }
    }

    case 'documento': {
      if (!t) return c.obrigatorio ? { valor: null, erro: 'Informe o CNPJ.' } : { valor: null }
      const d = digitos(t)
      if (d.length !== 14) return { valor: null, erro: 'O CNPJ tem 14 dígitos.' }
      return { valor: formatarCnpj(t) }
    }

    case 'senha': {
      if (!t) return c.obrigatorio ? { valor: null, erro: 'Informe a senha.' } : { valor: null }
      if (t.length < 8) return { valor: null, erro: 'Use pelo menos 8 caracteres.' }
      if (t.length > 128) return { valor: null, erro: 'Senha longa demais.' }
      return { valor: t }
    }

    case 'hora': {
      if (!t) return c.obrigatorio ? { valor: null, erro: 'Informe o horário.' } : { valor: null }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return { valor: null, erro: 'Use o formato HH:MM.' }
      return { valor: t }
    }

    case 'dias': {
      // Chegam como valores repetidos do mesmo nome; o chamador ja juntou.
      if (!t) return c.obrigatorio ? { valor: null, erro: 'Escolha ao menos um dia.' } : { valor: null }
      return { valor: t }
    }

    default: {
      if (!t) return c.obrigatorio ? { valor: null, erro: 'Campo obrigatório.' } : { valor: null }
      const max = c.maxLen ?? 255
      if (t.length > max) return { valor: null, erro: `Máximo de ${max} caracteres.` }
      return { valor: t }
    }
  }
}

/** Le o formulario segundo a especificacao e devolve valores limpos + erros. */
export function lerFormulario(
  spec: Especificacao,
  form: FormData,
  modo: 'criar' | 'editar'
): { valores: Valores; erros: Erros } {
  const valores: Valores = {}
  const erros: Erros = {}

  for (const c of spec.campos) {
    // Chave de negocio nao e reenviada na edicao; manter a do banco.
    if (modo === 'editar' && c.imutavel) continue

    const bruto = c.tipo === 'dias'
      ? form.getAll(c.nome).map((v) => so(v)).filter(Boolean).join(',')
      : so(form.get(c.nome))

    // Senha em branco na edicao significa "nao mexer": o formulario nunca
    // devolve a atual, entao tratar o vazio como valor gravaria hash de string
    // vazia e trancaria a pessoa para fora.
    if (c.tipo === 'senha' && !bruto && modo === 'editar') continue

    const r = validarCampo(c, bruto)
    if (r.erro) erros[c.nome] = r.erro
    else valores[c.nome] = r.valor
  }

  return { valores, erros }
}

/* ------------------------------------------------------------- escopo ---- */

/**
 * Empresa dona de um registro novo.
 *
 * Sem empresa no contexto (administrador central que ainda nao escolheu uma)
 * o cadastro nasce corporativo, visivel por todas. Entidades de escopo
 * `empresa` nao admitem isso: a coluna e obrigatoria no banco.
 */
export function empresaDoNovo(spec: Especificacao, s: Sessao): number | null | 'erro' {
  if (spec.escopo === 'plataforma') return null
  const id = s.empresa?.id ?? null
  if (spec.escopo === 'empresa' && id === null) return 'erro'
  return id
}

/**
 * Autorizacao para alterar um registro existente.
 *
 * O caso que importa e o do catalogo corporativo (empresa_id nulo): ele e
 * lido por todas as empresas, entao deixar um inquilino edita-lo mudaria o
 * dado debaixo dos outros sete. So o administrador central mexe nele.
 */
export function podeAlterar(spec: Especificacao, s: Sessao, empresaDoRegistro: number | null): boolean {
  const ehAdmin = s.autenticado?.perfil === 'admin_central'
  if (spec.escopo === 'plataforma') return ehAdmin
  if (empresaDoRegistro === null) return ehAdmin
  if (ehAdmin) return true
  return !!s.empresa && s.empresa.id === empresaDoRegistro
}

/* ------------------------------------------------------------ unicidade -- */

async function conflitoUnico(
  spec: Especificacao, valores: Valores, idAtual: number | null
): Promise<Erros | null> {
  if (!spec.unicos?.length) return null
  const erros: Erros = {}

  for (const col of spec.unicos) {
    const v = valores[col]
    if (v === undefined || v === null || v === '') continue
    const params: Params = [String(v)]
    let sql = `select id from ${spec.tabela} where lower(${col}) = lower(?)`
    if (idAtual !== null) { sql += ' and id <> ?'; params.push(idAtual) }
    const achou = await um<{ id: number }>(`${sql} limit 1`, params)
    if (achou) {
      const rotulo = spec.campos.find((c) => c.nome === col)?.rotulo ?? col
      erros[col] = `Já existe um registro com este ${rotulo.toLowerCase()}.`
    }
  }

  return Object.keys(erros).length ? erros : null
}

/* ------------------------------------------------------------- auditoria - */

export type Autor = { s: Sessao; ip: string }

function autorDe({ s, ip }: Autor) {
  const u = s.autenticado ?? s.usuario
  return { id: u.id, nome: u.nome, ip }
}

async function auditar(
  spec: Especificacao, autor: Autor, empresaId: number | null,
  registroId: number, rotulo: string, operacao: string,
  mudancas: Array<{ campo: string; de: string | null; para: string | null }>
) {
  const a = autorDe(autor)
  const agora = new Date().toISOString()
  for (const m of mudancas) {
    await executar(
      `insert into auditoria
        (empresa_id, entidade, entidade_id, entidade_rotulo, campo,
         valor_anterior, valor_novo, operacao, usuario_id, usuario_nome, ip, criado_em)
       values (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [empresaId, spec.tabela, registroId, rotulo.slice(0, 160), m.campo,
       m.de, m.para, operacao, a.id, a.nome, a.ip, agora])
  }
}

/** Texto legivel de um valor, para a coluna de auditoria. */
function comoTexto(c: Campo | undefined, v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  // A auditoria registra que a senha mudou, nunca o que ela e.
  if (c?.tipo === 'senha') return '••••••••'
  if (c?.tipo === 'booleano') return v === 1 || v === '1' ? 'sim' : 'não'
  if (c?.opcoes) {
    const o = c.opcoes.find((x) => x.valor === String(v))
    if (o) return o.rotulo
  }
  return String(v)
}

/* ---------------------------------------------------------------- criar -- */

export async function criarRegistro(
  spec: Especificacao, autor: Autor, valores: Valores
): Promise<Resultado> {
  const empresa = empresaDoNovo(spec, autor.s)
  if (empresa === 'erro') {
    return { ok: false, valores, erros: { _: 'Selecione uma empresa antes de criar este cadastro.' } }
  }

  const conflito = await conflitoUnico(spec, valores, null)
  if (conflito) return { ok: false, erros: conflito, valores }

  const colunas: string[] = []
  const marcas: string[] = []
  const params: Params = []
  const por = (col: string, v: string | number | null) => {
    colunas.push(col); marcas.push('?'); params.push(v)
  }

  for (const c of spec.campos) {
    if (!(c.nome in valores)) continue
    const v = valores[c.nome]
    por(colunaDe(c), c.tipo === 'senha' ? gerarHash(String(v)) : (v as string | number | null))
  }

  const agora = new Date().toISOString()
  for (const [col, v] of Object.entries(spec.derivar?.(valores) ?? {})) por(col, v)
  if (spec.escopo !== 'plataforma') por('empresa_id', empresa)
  if (spec.temCriadoEm) por('criado_em', agora)
  if (spec.temAtualizadoEm) por('atualizado_em', agora)
  if (spec.temAtivo && !colunas.includes('ativo')) por('ativo', 1)

  const rotulo = String(valores[spec.rotuloColuna] ?? 'registro')

  const id = await transacao(async () => {
    const novo = await inserirRetornandoId(
      `insert into ${spec.tabela} (${colunas.join(',')}) values (${marcas.join(',')})`, params)

    // Na inclusao a auditoria guarda o estado inicial de cada campo
    // preenchido: sem isso, uma alteracao futura mostraria "de X para Y" sem
    // que exista registro de onde X veio.
    const mudancas = spec.campos
      .filter((c) => c.nome in valores)
      .map((c) => ({ campo: c.rotulo, de: null, para: comoTexto(c, valores[c.nome]) }))
      .filter((m) => m.para !== null)

    await auditar(spec, autor, empresa, novo, rotulo, 'inclusao',
      mudancas.length ? mudancas : [{ campo: 'cadastro', de: null, para: 'criado' }])
    return novo
  })

  return { ok: true, id }
}

/* --------------------------------------------------------------- editar -- */

export async function editarRegistro(
  spec: Especificacao, autor: Autor, id: number, valores: Valores
): Promise<Resultado> {
  const atual = await um<Record<string, unknown>>(
    `select * from ${spec.tabela} where id = ?`, [id])
  if (!atual) return { ok: false, erros: { _: 'Registro não encontrado.' }, valores }

  const empresaDoRegistro = (atual.empresa_id as number | null) ?? null
  if (!podeAlterar(spec, autor.s, empresaDoRegistro)) {
    return { ok: false, valores, erros: { _: 'Este cadastro pertence a outro escopo e não pode ser alterado aqui.' } }
  }

  const conflito = await conflitoUnico(spec, valores, id)
  if (conflito) return { ok: false, erros: conflito, valores }

  const sets: string[] = []
  const params: Params = []
  const mudancas: Array<{ campo: string; de: string | null; para: string | null }> = []

  for (const c of spec.campos) {
    if (!(c.nome in valores)) continue
    const col = colunaDe(c)
    const novo = valores[c.nome]
    const velho = atual[col] ?? null

    if (c.tipo === 'senha') {
      sets.push(`${col} = ?`)
      params.push(gerarHash(String(novo)))
      mudancas.push({ campo: c.rotulo, de: null, para: comoTexto(c, novo) })
      continue
    }

    // Comparacao por texto: o SQLite devolve numero e o Postgres as vezes
    // string para a mesma coluna real. Comparar cru marcaria alteracao onde
    // nada mudou, e a auditoria encheria de ruido.
    const igual = String(velho ?? '') === String(novo ?? '')
    if (igual) continue

    sets.push(`${col} = ?`)
    params.push(novo as string | number | null)
    mudancas.push({ campo: c.rotulo, de: comoTexto(c, velho), para: comoTexto(c, novo) })
  }

  if (!sets.length) return { ok: true, id }

  // Colunas derivadas so sao recalculadas quando algo mudou; recalcular a cada
  // gravacao empurraria o proximo disparo para frente sem motivo.
  for (const [col, v] of Object.entries(spec.derivar?.(valores) ?? {})) {
    sets.push(`${col} = ?`); params.push(v)
  }

  const rotulo = String(valores[spec.rotuloColuna] ?? atual[spec.rotuloColuna] ?? 'registro')

  await transacao(async () => {
    if (spec.temAtualizadoEm) { sets.push('atualizado_em = ?'); params.push(new Date().toISOString()) }
    await executar(`update ${spec.tabela} set ${sets.join(', ')} where id = ?`, [...params, id])
    await auditar(spec, autor, empresaDoRegistro, id, rotulo, 'alteracao', mudancas)
  })

  return { ok: true, id }
}

/* ------------------------------------------------------------- alternar -- */

/**
 * Liga/desliga uma coluna booleana (ativo, homologado).
 *
 * Inativar e a exclusao padrao dos cadastros: o registro sai das listagens e
 * das cotacoes, mas continua referenciado por cotacoes antigas, propostas e
 * pela propria auditoria. Apagar de verdade romperia esse historico.
 */
export async function alternarColuna(
  spec: Especificacao, autor: Autor, id: number, coluna: 'ativo' | 'homologado', ligar: boolean
): Promise<{ ok: boolean; erro?: string }> {
  const campo = spec.campos.find((c) => c.nome === coluna && c.tipo === 'booleano')
  if (!campo) return { ok: false, erro: 'Coluna não alternável.' }

  const atual = await um<Record<string, unknown>>(`select * from ${spec.tabela} where id = ?`, [id])
  if (!atual) return { ok: false, erro: 'Registro não encontrado.' }

  const empresaDoRegistro = (atual.empresa_id as number | null) ?? null
  if (!podeAlterar(spec, autor.s, empresaDoRegistro)) {
    return { ok: false, erro: 'Sem permissão sobre este registro.' }
  }

  const de = Number(atual[coluna] ?? 0)
  const para = ligar ? 1 : 0
  if (de === para) return { ok: true }

  const operacao = coluna === 'ativo' ? (ligar ? 'reativacao' : 'inativacao') : 'alteracao'
  const rotulo = String(atual[spec.rotuloColuna] ?? 'registro')

  await transacao(async () => {
    const extra = spec.temAtualizadoEm ? ', atualizado_em = ?' : ''
    const params: Params = spec.temAtualizadoEm
      ? [para, new Date().toISOString(), id] : [para, id]
    await executar(`update ${spec.tabela} set ${coluna} = ?${extra} where id = ?`, params)
    await auditar(spec, autor, empresaDoRegistro, id, rotulo, operacao,
      [{ campo: campo.rotulo, de: comoTexto(campo, de), para: comoTexto(campo, para) }])
  })

  return { ok: true }
}

/* -------------------------------------------------------------- excluir -- */

/**
 * Exclusao fisica, permitida so onde a especificacao autoriza e nada aponta
 * para o registro. Fora disso o caminho e inativar.
 */
export async function excluirRegistro(
  spec: Especificacao, autor: Autor, id: number,
  dependencias: Array<{ tabela: string; coluna: string; rotulo: string }> = []
): Promise<{ ok: boolean; erro?: string }> {
  if (!spec.exclusaoFisica) return { ok: false, erro: 'Este cadastro só pode ser inativado.' }

  const atual = await um<Record<string, unknown>>(`select * from ${spec.tabela} where id = ?`, [id])
  if (!atual) return { ok: false, erro: 'Registro não encontrado.' }

  const empresaDoRegistro = (atual.empresa_id as number | null) ?? null
  if (!podeAlterar(spec, autor.s, empresaDoRegistro)) {
    return { ok: false, erro: 'Sem permissão sobre este registro.' }
  }

  for (const d of dependencias) {
    const r = await um<{ c: number | string }>(
      `select count(*) c from ${d.tabela} where ${d.coluna} = ?`, [id])
    if (Number(r?.c ?? 0) > 0) {
      return { ok: false, erro: `Não é possível excluir: existem ${d.rotulo} vinculados. Inative o registro.` }
    }
  }

  const rotulo = String(atual[spec.rotuloColuna] ?? 'registro')
  await transacao(async () => {
    for (const r of spec.limparReferencias ?? []) {
      await executar(`update ${r.tabela} set ${r.coluna} = null where ${r.coluna} = ?`, [id])
    }
    await executar(`delete from ${spec.tabela} where id = ?`, [id])
    await auditar(spec, autor, empresaDoRegistro, id, rotulo, 'exclusao',
      [{ campo: 'cadastro', de: rotulo, para: null }])
  })

  return { ok: true }
}

/* ------------------------------------------------------ opcoes dinamicas - */

export type ListaOpcoes = Record<string, Array<{ valor: string; rotulo: string }>>

/** Carrega as opcoes das referencias usadas pelos campos da especificacao. */
export async function opcoesDe(spec: Especificacao, idEmpresa: number | null): Promise<ListaOpcoes> {
  const fontes = new Set(spec.campos.map((c) => c.fonte).filter(Boolean) as string[])
  const saida: ListaOpcoes = {}

  if (fontes.has('unidades')) {
    const r = await todos<{ id: number; sigla: string; descricao: string }>(
      'select id, sigla, descricao from unidades order by sigla')
    saida.unidades = r.map((u) => ({ valor: String(u.id), rotulo: `${u.sigla} — ${u.descricao}` }))
  }

  if (fontes.has('classes')) {
    // Nivel 5 e a folha da hierarquia: e a unica que um material referencia.
    const r = await todos<{ id: number; caminho: string }>(
      'select id, caminho from classificacoes where nivel = 5 order by caminho')
    saida.classes = r.map((c) => ({ valor: String(c.id), rotulo: c.caminho }))
  }

  if (fontes.has('empresas')) {
    const r = await todos<{ id: number; nome_fantasia: string }>(
      'select id, nome_fantasia from empresas where ativo = 1 order by nome_fantasia')
    saida.empresas = r.map((e) => ({ valor: String(e.id), rotulo: e.nome_fantasia }))
  }

  if (fontes.has('fornecedores')) {
    const r = await todos<{ id: number; razao_social: string }>(
      `select id, razao_social from fornecedores
        where ativo = 1 and homologado = 1 and (empresa_id is null or empresa_id = ?)
        order by razao_social limit 400`, [idEmpresa])
    saida.fornecedores = r.map((f) => ({ valor: String(f.id), rotulo: f.razao_social }))
  }

  return saida
}
