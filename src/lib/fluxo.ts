// =====================================================================
// Ciclo de vida de demandas e cotacoes.
//
// Os cadastros passam pelo motor generico de `gravar.ts`, guiado pela
// especificacao. Aqui e diferente: o que existe nao e um formulario com
// campos, e uma maquina de estados. Uma cotacao nao "tem status igual a
// encerrada" — ela foi encerrada por alguem, num instante, vindo de um
// estado anterior que permitia isso.
//
// Por isso cada operacao:
//   1. confere o estado de origem antes de gravar o de destino;
//   2. confina o registro a empresa da sessao;
//   3. escreve a auditoria na mesma transacao.
//
// Recusa nunca lanca excecao: devolve `{ ok: false, erro }`, que a rota
// transforma em faixa vermelha na tela de onde a acao partiu.
// =====================================================================
import { randomBytes } from 'node:crypto'
import { um, todos, executar, inserirRetornandoId, transacao } from './db'
import type { Sessao } from './sessao'
import { enviarConvites, avisarEncerramento, emSegundoPlano } from './disparo'

export type Fim = { ok: true; destino: string } | { ok: false; erro: string }
/**
 * Quem executa a acao. `base` e o endereco publico da plataforma, capturado
 * na requisicao: os links que saem por e-mail sao absolutos e precisam dele,
 * e quem envia roda depois da resposta, sem requisicao por perto.
 */
export type Autor = { s: Sessao; ip: string; base: string }

const agora = () => new Date().toISOString()
const so = (v: FormDataEntryValue | null) => String(v ?? '').trim()

/** Numero em pt-BR ("1.234,56" e "1234.56" chegam ao mesmo lugar). */
function numeroBr(bruto: string): number | null {
  const t = bruto.trim()
  if (!t) return null
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) ? n : null
}

/* ------------------------------------------------------------ auditoria -- */

async function anotar(
  autor: Autor, empresaId: number, entidade: string, entidadeId: number,
  rotulo: string, operacao: string,
  mudancas: Array<{ campo: string; de: string | null; para: string | null }>
) {
  const u = autor.s.autenticado ?? autor.s.usuario
  const quando = agora()
  for (const m of mudancas) {
    await executar(
      `insert into auditoria
        (empresa_id, entidade, entidade_id, entidade_rotulo, campo,
         valor_anterior, valor_novo, operacao, usuario_id, usuario_nome, ip, criado_em)
       values (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [empresaId, entidade, entidadeId, rotulo.slice(0, 160), m.campo,
       m.de, m.para, operacao, u.id, u.nome, autor.ip, quando])
  }
}

/* -------------------------------------------------------------- numeracao */

/**
 * Proximo numero da serie, no formato `PREFIXO-ANO-00001`.
 *
 * A serie e da plataforma inteira, e nao de cada empresa: o numero aparece
 * em e-mail para fornecedor, que atende varias empresas ao mesmo tempo.
 * Dois "COT-2026-00007" diferentes na caixa de entrada do mesmo vendedor
 * seria a origem de uma proposta trocada.
 */
async function proximoNumero(tabela: 'demandas' | 'cotacoes', prefixo: string): Promise<string> {
  const ano = new Date().getFullYear()
  const marca = `${prefixo}-${ano}-`
  const ultimo = await um<{ numero: string }>(
    `select numero from ${tabela} where numero like ? order by numero desc limit 1`, [`${marca}%`])
  const seq = ultimo ? Number(ultimo.numero.slice(marca.length)) || 0 : 0
  return `${marca}${String(seq + 1).padStart(5, '0')}`
}

/* ------------------------------------------------------------- contexto -- */

/** Empresa sobre a qual a acao grava. Sem empresa no contexto, nao ha onde. */
function empresaDe(s: Sessao): number | null {
  return s.empresa?.id ?? null
}

type Demanda = { id: number; empresa_id: number; numero: string; status: string }
type Cot = {
  id: number; empresa_id: number; numero: string; titulo: string; status: string
  demanda_id: number | null; disparo_tipo: string; canal: string; encerra_em: string | null
}

async function demandaDe(id: number, eid: number | null): Promise<Demanda | null> {
  const d = await um<Demanda>('select id, empresa_id, numero, status from demandas where id = ?', [id])
  if (!d) return null
  if (eid !== null && d.empresa_id !== eid) return null
  return d
}

async function cotacaoDe(id: number, eid: number | null): Promise<Cot | null> {
  const c = await um<Cot>(
    `select id, empresa_id, numero, titulo, status, demanda_id, disparo_tipo, canal, encerra_em
       from cotacoes where id = ?`, [id])
  if (!c) return null
  if (eid !== null && c.empresa_id !== eid) return null
  return c
}

const ORIGENS = ['requisicao', 'estoque_minimo', 'manual', 'erp']
const CANAIS = ['email', 'portal', 'ambos']

/* ================================================================ DEMANDAS */

export async function criarDemanda(autor: Autor, f: FormData): Promise<Fim> {
  const eid = empresaDe(autor.s)
  if (eid === null) return { ok: false, erro: 'Escolha uma empresa no topo da tela antes de abrir uma demanda.' }

  const origem = so(f.get('origem'))
  const solicitante = so(f.get('solicitante')) || autor.s.usuario.nome
  const centro = so(f.get('centro_custo'))
  if (!ORIGENS.includes(origem)) return { ok: false, erro: 'Selecione a origem da demanda.' }
  if (!centro) return { ok: false, erro: 'Informe o centro de custo.' }

  return transacao(async () => {
    const numero = await proximoNumero('demandas', 'REQ')
    const id = await inserirRetornandoId(
      `insert into demandas (empresa_id, numero, origem, solicitante, centro_custo, status, criado_em)
       values (?,?,?,?,?,?,?)`,
      [eid, numero, origem, solicitante.slice(0, 90), centro.slice(0, 80), 'aberta', agora()])
    await anotar(autor, eid, 'demandas', id, numero, 'inclusao', [
      { campo: 'status', de: null, para: 'aberta' },
      { campo: 'origem', de: null, para: origem },
      { campo: 'solicitante', de: null, para: solicitante },
      { campo: 'centro_custo', de: null, para: centro },
    ])
    return { ok: true as const, destino: `/demandas/${id}?ok=aberta` }
  })
}

export async function adicionarItemDemanda(autor: Autor, f: FormData): Promise<Fim> {
  const eid = empresaDe(autor.s)
  const d = await demandaDe(Number(f.get('_id')), eid)
  if (!d) return { ok: false, erro: 'Demanda não encontrada.' }
  if (d.status !== 'aberta') return { ok: false, erro: 'Só é possível incluir itens enquanto a demanda está aberta.' }

  const materialId = Number(so(f.get('material_id')))
  const quantidade = numeroBr(so(f.get('quantidade')))
  if (!Number.isInteger(materialId) || materialId <= 0) return { ok: false, erro: 'Selecione o material.' }
  if (quantidade === null || quantidade <= 0) return { ok: false, erro: 'Informe uma quantidade maior que zero.' }

  const m = await um<{ id: number; descricao: string; unidade_id: number; empresa_id: number | null }>(
    'select id, descricao, unidade_id, empresa_id from materiais where id = ? and ativo = 1', [materialId])
  if (!m) return { ok: false, erro: 'Material inativo ou inexistente.' }
  // Catalogo corporativo (empresa_id nulo) e comum; o proprio da outra empresa nao.
  if (m.empresa_id !== null && m.empresa_id !== d.empresa_id) return { ok: false, erro: 'Material de outra empresa.' }

  const jaTem = await um<{ id: number; quantidade: number }>(
    'select id, quantidade from demanda_itens where demanda_id = ? and material_id = ?', [d.id, materialId])

  return transacao(async () => {
    if (jaTem) {
      // Repetir o mesmo material soma, em vez de criar duas linhas do mesmo
      // item — que virariam dois precos para a mesma coisa na equalizacao.
      const novo = jaTem.quantidade + quantidade
      await executar('update demanda_itens set quantidade = ? where id = ?', [novo, jaTem.id])
      await anotar(autor, d.empresa_id, 'demandas', d.id, d.numero, 'alteracao', [
        { campo: `item:${m.descricao}`, de: String(jaTem.quantidade), para: String(novo) },
      ])
    } else {
      await executar(
        'insert into demanda_itens (demanda_id, material_id, quantidade, unidade_id) values (?,?,?,?)',
        [d.id, materialId, quantidade, m.unidade_id])
      await anotar(autor, d.empresa_id, 'demandas', d.id, d.numero, 'alteracao', [
        { campo: `item:${m.descricao}`, de: null, para: String(quantidade) },
      ])
    }
    return { ok: true as const, destino: `/demandas/${d.id}?ok=item` }
  })
}

export async function removerItemDemanda(autor: Autor, f: FormData): Promise<Fim> {
  const eid = empresaDe(autor.s)
  const d = await demandaDe(Number(f.get('_id')), eid)
  if (!d) return { ok: false, erro: 'Demanda não encontrada.' }
  if (d.status !== 'aberta') return { ok: false, erro: 'A demanda já saiu do estado aberto.' }

  const itemId = Number(so(f.get('item_id')))
  const item = await um<{ id: number; descricao: string; quantidade: number }>(
    `select di.id, m.descricao, di.quantidade from demanda_itens di
       join materiais m on m.id = di.material_id
      where di.id = ? and di.demanda_id = ?`, [itemId, d.id])
  if (!item) return { ok: false, erro: 'Item não encontrado nesta demanda.' }

  return transacao(async () => {
    await executar('delete from demanda_itens where id = ?', [item.id])
    await anotar(autor, d.empresa_id, 'demandas', d.id, d.numero, 'alteracao', [
      { campo: `item:${item.descricao}`, de: String(item.quantidade), para: null },
    ])
    return { ok: true as const, destino: `/demandas/${d.id}?ok=removido` }
  })
}

export async function mudarStatusDemanda(autor: Autor, f: FormData): Promise<Fim> {
  const eid = empresaDe(autor.s)
  const d = await demandaDe(Number(f.get('_id')), eid)
  if (!d) return { ok: false, erro: 'Demanda não encontrada.' }

  const destinoStatus = so(f.get('_status'))
  const permitido: Record<string, string[]> = {
    cancelada: ['aberta', 'em_cotacao'],
    aberta: ['cancelada'],
    atendida: ['em_cotacao'],
  }
  if (!permitido[destinoStatus]?.includes(d.status)) {
    return { ok: false, erro: 'Esta transição não é permitida a partir do estado atual.' }
  }

  return transacao(async () => {
    await executar('update demandas set status = ? where id = ?', [destinoStatus, d.id])
    await anotar(autor, d.empresa_id, 'demandas', d.id, d.numero,
      destinoStatus === 'cancelada' ? 'inativacao' : 'alteracao',
      [{ campo: 'status', de: d.status, para: destinoStatus }])
    const marca = destinoStatus === 'cancelada' ? 'cancelada' : destinoStatus === 'atendida' ? 'atendida' : 'reaberta'
    return { ok: true as const, destino: `/demandas/${d.id}?ok=${marca}` }
  })
}

/* ================================================================ COTACOES */

/** Cria a cotacao e, quando vem de uma demanda, copia os itens dela. */
export async function criarCotacao(autor: Autor, f: FormData): Promise<Fim> {
  const eid = empresaDe(autor.s)
  if (eid === null) return { ok: false, erro: 'Escolha uma empresa no topo da tela antes de abrir uma cotação.' }

  const comprador = (autor.s.autenticado ?? autor.s.usuario).id
  const idDemanda = Number(so(f.get('demanda_id'))) || 0
  const canal = so(f.get('canal')) || 'ambos'
  if (!CANAIS.includes(canal)) return { ok: false, erro: 'Canal inválido.' }

  const janela = Math.min(720, Math.max(1, Number(so(f.get('janela_horas'))) || 48))
  const taxa = numeroBr(so(f.get('taxa_capital_mes'))) ?? 1.5
  const peso = numeroBr(so(f.get('peso_prazo_dia'))) ?? 0

  let demanda: Demanda | null = null
  if (idDemanda) {
    demanda = await demandaDe(idDemanda, eid)
    if (!demanda) return { ok: false, erro: 'Demanda não encontrada.' }
    if (demanda.status !== 'aberta') return { ok: false, erro: 'Esta demanda já foi encaminhada para cotação.' }
    const qtd = await um<{ c: number }>('select count(*) c from demanda_itens where demanda_id = ?', [demanda.id])
    if (!qtd?.c) return { ok: false, erro: 'Inclua ao menos um item na demanda antes de gerar a cotação.' }
  }

  const titulo = (so(f.get('titulo')) || (demanda ? `Cotação da requisição ${demanda.numero}` : '')).slice(0, 120)
  if (!titulo) return { ok: false, erro: 'Informe um título para a cotação.' }

  return transacao(async () => {
    const numero = await proximoNumero('cotacoes', 'COT')
    const encerraEm = new Date(Date.now() + janela * 3_600_000).toISOString()
    const id = await inserirRetornandoId(
      `insert into cotacoes
        (empresa_id, demanda_id, numero, titulo, comprador_id, status, disparo_tipo, canal,
         criado_em, encerra_em, taxa_capital_mes, peso_prazo_dia)
       values (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [eid, demanda?.id ?? null, numero, titulo, comprador, 'rascunho', 'manual', canal,
       agora(), encerraEm, taxa, peso])

    if (demanda) {
      const itens = await todos<{ material_id: number; quantidade: number; unidade_id: number }>(
        'select material_id, quantidade, unidade_id from demanda_itens where demanda_id = ? order by id', [demanda.id])
      let ordem = 0
      for (const it of itens) {
        await executar(
          'insert into cotacao_itens (cotacao_id, material_id, quantidade, unidade_id, ordem) values (?,?,?,?,?)',
          [id, it.material_id, it.quantidade, it.unidade_id, ++ordem])
      }
      await executar('update demandas set status = ? where id = ?', ['em_cotacao', demanda.id])
      await anotar(autor, eid, 'demandas', demanda.id, demanda.numero, 'alteracao', [
        { campo: 'status', de: demanda.status, para: 'em_cotacao' },
        { campo: 'cotacao', de: null, para: numero },
      ])
    }

    await anotar(autor, eid, 'cotacoes', id, numero, 'inclusao', [
      { campo: 'status', de: null, para: 'rascunho' },
      { campo: 'titulo', de: null, para: titulo },
      { campo: 'canal', de: null, para: canal },
      ...(demanda ? [{ campo: 'demanda', de: null, para: demanda.numero }] : []),
    ])
    return { ok: true as const, destino: `/cotacoes/${id}?ok=${demanda ? 'gerada' : 'aberta'}` }
  })
}

const EDITAVEL = ['rascunho', 'programada']

export async function adicionarItemCotacao(autor: Autor, f: FormData): Promise<Fim> {
  const eid = empresaDe(autor.s)
  const c = await cotacaoDe(Number(f.get('_id')), eid)
  if (!c) return { ok: false, erro: 'Cotação não encontrada.' }
  if (!EDITAVEL.includes(c.status)) {
    return { ok: false, erro: 'Depois de disparada, a lista de itens não muda — os fornecedores já cotaram sobre ela.' }
  }

  const materialId = Number(so(f.get('material_id')))
  const quantidade = numeroBr(so(f.get('quantidade')))
  if (!Number.isInteger(materialId) || materialId <= 0) return { ok: false, erro: 'Selecione o material.' }
  if (quantidade === null || quantidade <= 0) return { ok: false, erro: 'Informe uma quantidade maior que zero.' }

  const m = await um<{ id: number; descricao: string; unidade_id: number; empresa_id: number | null }>(
    'select id, descricao, unidade_id, empresa_id from materiais where id = ? and ativo = 1', [materialId])
  if (!m) return { ok: false, erro: 'Material inativo ou inexistente.' }
  if (m.empresa_id !== null && m.empresa_id !== c.empresa_id) return { ok: false, erro: 'Material de outra empresa.' }

  const jaTem = await um<{ id: number; quantidade: number }>(
    'select id, quantidade from cotacao_itens where cotacao_id = ? and material_id = ?', [c.id, materialId])

  return transacao(async () => {
    if (jaTem) {
      const novo = jaTem.quantidade + quantidade
      await executar('update cotacao_itens set quantidade = ? where id = ?', [novo, jaTem.id])
      await anotar(autor, c.empresa_id, 'cotacoes', c.id, c.numero, 'alteracao', [
        { campo: `item:${m.descricao}`, de: String(jaTem.quantidade), para: String(novo) },
      ])
    } else {
      const ordem = (await um<{ n: number }>(
        'select coalesce(max(ordem), 0) n from cotacao_itens where cotacao_id = ?', [c.id]))?.n ?? 0
      await executar(
        'insert into cotacao_itens (cotacao_id, material_id, quantidade, unidade_id, ordem) values (?,?,?,?,?)',
        [c.id, materialId, quantidade, m.unidade_id, Number(ordem) + 1])
      await anotar(autor, c.empresa_id, 'cotacoes', c.id, c.numero, 'alteracao', [
        { campo: `item:${m.descricao}`, de: null, para: String(quantidade) },
      ])
    }
    return { ok: true as const, destino: `/cotacoes/${c.id}?ok=item` }
  })
}

export async function removerItemCotacao(autor: Autor, f: FormData): Promise<Fim> {
  const eid = empresaDe(autor.s)
  const c = await cotacaoDe(Number(f.get('_id')), eid)
  if (!c) return { ok: false, erro: 'Cotação não encontrada.' }
  if (!EDITAVEL.includes(c.status)) return { ok: false, erro: 'A cotação já foi disparada.' }

  const itemId = Number(so(f.get('item_id')))
  const item = await um<{ id: number; descricao: string; quantidade: number }>(
    `select ci.id, m.descricao, ci.quantidade from cotacao_itens ci
       join materiais m on m.id = ci.material_id
      where ci.id = ? and ci.cotacao_id = ?`, [itemId, c.id])
  if (!item) return { ok: false, erro: 'Item não encontrado nesta cotação.' }

  return transacao(async () => {
    // Nenhuma proposta existe antes do disparo, mas a limpeza mantem a
    // consistencia caso o item tenha vindo de um rascunho reaproveitado.
    await executar('delete from proposta_itens where cotacao_item_id = ?', [item.id])
    await executar('delete from cotacao_itens where id = ?', [item.id])
    await anotar(autor, c.empresa_id, 'cotacoes', c.id, c.numero, 'alteracao', [
      { campo: `item:${item.descricao}`, de: String(item.quantidade), para: null },
    ])
    return { ok: true as const, destino: `/cotacoes/${c.id}?ok=removido` }
  })
}

/**
 * Token do convite.
 *
 * E ele que autentica o fornecedor no portal — quem tem o token responde a
 * cotacao. Por isso vem de `randomBytes`, e nao de contador ou de `Math.random`:
 * um token adivinhavel deixaria um concorrente ler a rodada inteira.
 */
function novoToken(): string {
  return 'PT' + randomBytes(16).toString('hex').toUpperCase().slice(0, 24)
}

export async function convidarFornecedor(autor: Autor, f: FormData): Promise<Fim> {
  const eid = empresaDe(autor.s)
  const c = await cotacaoDe(Number(f.get('_id')), eid)
  if (!c) return { ok: false, erro: 'Cotação não encontrada.' }
  if (c.status === 'encerrada' || c.status === 'equalizada' || c.status === 'cancelada') {
    return { ok: false, erro: 'A cotação não aceita mais convites.' }
  }

  const fid = Number(so(f.get('fornecedor_id')))
  const forn = await um<{ id: number; razao_social: string; empresa_id: number | null; homologado: number; ativo: number }>(
    'select id, razao_social, empresa_id, homologado, ativo from fornecedores where id = ?', [fid])
  if (!forn) return { ok: false, erro: 'Fornecedor não encontrado.' }
  if (!forn.ativo) return { ok: false, erro: 'Fornecedor inativo.' }
  if (!forn.homologado) return { ok: false, erro: 'Só fornecedores homologados podem ser convidados.' }
  if (forn.empresa_id !== null && forn.empresa_id !== c.empresa_id) return { ok: false, erro: 'Fornecedor de outra empresa.' }

  const ja = await um<{ id: number }>(
    'select id from cotacao_fornecedores where cotacao_id = ? and fornecedor_id = ?', [c.id, forn.id])
  if (ja) return { ok: false, erro: 'Este fornecedor já foi convidado.' }

  return transacao(async () => {
    await executar(
      `insert into cotacao_fornecedores (cotacao_id, fornecedor_id, token, status, convidado_em)
       values (?,?,?,?,?)`, [c.id, forn.id, novoToken(), 'convidado', agora()])
    await anotar(autor, c.empresa_id, 'cotacoes', c.id, c.numero, 'alteracao', [
      { campo: 'convidado', de: null, para: forn.razao_social },
    ])
    return { ok: true as const, destino: `/cotacoes/${c.id}?ok=convidado` }
  })
}

/**
 * Convida de uma vez os fornecedores homologados habilitados nos grupos dos
 * itens — o mesmo criterio que o disparo programado usa.
 *
 * Com teto: o catalogo corporativo tem milhares de homologados, e um clique
 * que dispara e-mail para todos eles nao e uma cotacao, e um incidente —
 * sem desfazer, porque a mensagem ja saiu. Convida os melhor avaliados ate
 * o teto e diz na tela quantos ficaram de fora, para o comprador escolher
 * o resto a dedo se quiser.
 */
const TETO_CONVITE = 40

export async function convidarAptos(autor: Autor, f: FormData): Promise<Fim> {
  const eid = empresaDe(autor.s)
  const c = await cotacaoDe(Number(f.get('_id')), eid)
  if (!c) return { ok: false, erro: 'Cotação não encontrada.' }
  if (c.status === 'encerrada' || c.status === 'equalizada' || c.status === 'cancelada') {
    return { ok: false, erro: 'A cotação não aceita mais convites.' }
  }

  const aptos = await todos<{ id: number; razao_social: string }>(
    `select distinct f.id, f.razao_social
       from cotacao_itens ci
       join materiais m on m.id = ci.material_id
       join classificacoes cl on cl.id = m.classificacao_id
       join classificacoes raiz on raiz.nivel = 1 and cl.caminho like raiz.nome || ' ›%'
       join fornecedor_grupos fg on fg.classificacao_id = raiz.id
       join fornecedores f on f.id = fg.fornecedor_id
      where ci.cotacao_id = ? and f.ativo = 1 and f.homologado = 1
        and (f.empresa_id is null or f.empresa_id = ?)
        and not exists (select 1 from cotacao_fornecedores cf
                         where cf.cotacao_id = ci.cotacao_id and cf.fornecedor_id = f.id)
      order by f.avaliacao desc, f.razao_social
      limit ?`, [c.id, c.empresa_id, TETO_CONVITE + 1])

  if (aptos.length === 0) {
    return { ok: false, erro: 'Nenhum fornecedor novo habilitado nos grupos destes itens.' }
  }

  const sobraram = Math.max(0, aptos.length - TETO_CONVITE)
  const convidar = aptos.slice(0, TETO_CONVITE)

  return transacao(async () => {
    for (const a of convidar) {
      await executar(
        `insert into cotacao_fornecedores (cotacao_id, fornecedor_id, token, status, convidado_em)
         values (?,?,?,?,?)`, [c.id, a.id, novoToken(), 'convidado', agora()])
    }
    await anotar(autor, c.empresa_id, 'cotacoes', c.id, c.numero, 'alteracao',
      convidar.map((a) => ({ campo: 'convidado', de: null, para: a.razao_social })))
    return {
      ok: true as const,
      destino: `/cotacoes/${c.id}?ok=${sobraram > 0 ? 'convidados_teto' : 'convidados'}`,
    }
  })
}

export async function removerConvite(autor: Autor, f: FormData): Promise<Fim> {
  const eid = empresaDe(autor.s)
  const c = await cotacaoDe(Number(f.get('_id')), eid)
  if (!c) return { ok: false, erro: 'Cotação não encontrada.' }

  const cfId = Number(so(f.get('convite_id')))
  const cf = await um<{ id: number; fornecedor_id: number; status: string; razao_social: string }>(
    `select cf.id, cf.fornecedor_id, cf.status, f.razao_social
       from cotacao_fornecedores cf join fornecedores f on f.id = cf.fornecedor_id
      where cf.id = ? and cf.cotacao_id = ?`, [cfId, c.id])
  if (!cf) return { ok: false, erro: 'Convite não encontrado.' }
  if (cf.status === 'respondido') {
    return { ok: false, erro: 'Este fornecedor já respondeu — a proposta faz parte do histórico da rodada.' }
  }

  return transacao(async () => {
    await executar('delete from cotacao_fornecedores where id = ?', [cf.id])
    await anotar(autor, c.empresa_id, 'cotacoes', c.id, c.numero, 'alteracao', [
      { campo: 'convidado', de: cf.razao_social, para: null },
    ])
    return { ok: true as const, destino: `/cotacoes/${c.id}?ok=desconvidado` }
  })
}

/** Dispara os convites: e o instante em que a rodada passa a correr. */
export async function dispararCotacao(autor: Autor, f: FormData): Promise<Fim> {
  const eid = empresaDe(autor.s)
  const c = await cotacaoDe(Number(f.get('_id')), eid)
  if (!c) return { ok: false, erro: 'Cotação não encontrada.' }
  if (!EDITAVEL.includes(c.status)) return { ok: false, erro: 'Esta cotação já foi disparada.' }

  const itens = (await um<{ c: number }>('select count(*) c from cotacao_itens where cotacao_id = ?', [c.id]))?.c ?? 0
  if (!Number(itens)) return { ok: false, erro: 'Inclua ao menos um item antes de disparar.' }

  const convites = await todos<{ id: number }>(
    'select id from cotacao_fornecedores where cotacao_id = ?', [c.id])
  if (convites.length === 0) return { ok: false, erro: 'Convide ao menos um fornecedor antes de disparar.' }

  const janela = Math.min(720, Math.max(1, Number(so(f.get('janela_horas'))) || 48))

  const fim = await transacao(async () => {
    const quando = agora()
    const encerra = new Date(Date.now() + janela * 3_600_000).toISOString()
    await executar(
      'update cotacoes set status = ?, disparado_em = ?, encerra_em = ? where id = ?',
      ['em_andamento', quando, encerra, c.id])
    // Entregues e falhas nascem zerados e sobem conforme o SMTP responde.
    // Preenche-los aqui seria inventar um numero: no instante do commit
    // nenhuma mensagem saiu ainda.
    const disparoId = await inserirRetornandoId(
      `insert into disparo_logs
        (empresa_id, cotacao_id, agendamento_id, canal, destinatarios, entregues, falhas, origem, criado_em)
       values (?,?,?,?,?,?,?,?,?)`,
      [c.empresa_id, c.id, null, c.canal, convites.length, 0, 0, 'manual', quando])
    await anotar(autor, c.empresa_id, 'cotacoes', c.id, c.numero, 'alteracao', [
      { campo: 'status', de: c.status, para: 'em_andamento' },
      { campo: 'disparado_em', de: null, para: quando },
      { campo: 'destinatarios', de: null, para: String(convites.length) },
    ])
    return { disparoId, destino: `/cotacoes/${c.id}?ok=disparada` }
  })

  // Canal `portal` significa que o fornecedor ja acompanha a rodada por
  // dentro; nao ha e-mail a mandar. Nos outros dois, o envio corre depois
  // do commit — a transacao nao pode ficar aberta esperando o SMTP.
  if (c.canal !== 'portal') {
    emSegundoPlano(() => enviarConvites({
      cotacaoId: c.id, base: autor.base, disparoId: fim.disparoId, tipo: 'convite',
    }))
  }

  return { ok: true as const, destino: fim.destino }
}

export async function mudarStatusCotacao(autor: Autor, f: FormData): Promise<Fim> {
  const eid = empresaDe(autor.s)
  const c = await cotacaoDe(Number(f.get('_id')), eid)
  if (!c) return { ok: false, erro: 'Cotação não encontrada.' }

  const destinoStatus = so(f.get('_status'))
  const permitido: Record<string, string[]> = {
    encerrada: ['em_andamento'],
    em_andamento: ['encerrada'],
    equalizada: ['encerrada'],
    cancelada: ['rascunho', 'programada', 'em_andamento', 'encerrada'],
  }
  if (!permitido[destinoStatus]?.includes(c.status)) {
    return { ok: false, erro: 'Esta transição não é permitida a partir do estado atual.' }
  }

  if (destinoStatus === 'equalizada') {
    const r = (await um<{ c: number }>('select count(*) c from propostas where cotacao_id = ?', [c.id]))?.c ?? 0
    if (!Number(r)) return { ok: false, erro: 'Não há propostas recebidas para equalizar.' }
  }

  const fim = await transacao(async () => {
    const quando = agora()
    if (destinoStatus === 'encerrada') {
      await executar('update cotacoes set status = ?, encerrado_em = ? where id = ?', [destinoStatus, quando, c.id])
    } else if (destinoStatus === 'em_andamento') {
      // Reabrir devolve prazo: sem isso a rodada voltaria ja vencida.
      const encerra = new Date(Date.now() + 24 * 3_600_000).toISOString()
      await executar(
        'update cotacoes set status = ?, encerrado_em = null, encerra_em = ? where id = ?',
        [destinoStatus, encerra, c.id])
    } else {
      await executar('update cotacoes set status = ? where id = ?', [destinoStatus, c.id])
    }

    await anotar(autor, c.empresa_id, 'cotacoes', c.id, c.numero,
      destinoStatus === 'cancelada' ? 'inativacao' : 'alteracao',
      [{ campo: 'status', de: c.status, para: destinoStatus }])

    // Cancelar a cotacao devolve a demanda para a fila, em vez de deixa-la
    // presa em "em_cotacao" sem nenhuma rodada viva.
    if (destinoStatus === 'cancelada' && c.demanda_id) {
      const d = await um<{ numero: string; status: string }>(
        'select numero, status from demandas where id = ?', [c.demanda_id])
      if (d && d.status === 'em_cotacao') {
        await executar('update demandas set status = ? where id = ?', ['aberta', c.demanda_id])
        await anotar(autor, c.empresa_id, 'demandas', c.demanda_id, d.numero, 'alteracao', [
          { campo: 'status', de: d.status, para: 'aberta' },
        ])
      }
    }
    if (destinoStatus === 'equalizada' && c.demanda_id) {
      const d = await um<{ numero: string; status: string }>(
        'select numero, status from demandas where id = ?', [c.demanda_id])
      if (d && d.status === 'em_cotacao') {
        await executar('update demandas set status = ? where id = ?', ['atendida', c.demanda_id])
        await anotar(autor, c.empresa_id, 'demandas', c.demanda_id, d.numero, 'alteracao', [
          { campo: 'status', de: d.status, para: 'atendida' },
        ])
      }
    }

    const marca: Record<string, string> = {
      encerrada: 'encerrada', em_andamento: 'reaberta', equalizada: 'equalizada', cancelada: 'cancelada',
    }
    const volta = destinoStatus === 'equalizada' ? `/cotacoes/${c.id}/equalizacao` : `/cotacoes/${c.id}`
    return { ok: true as const, destino: `${volta}?ok=${marca[destinoStatus]}` }
  })

  // Fechar a rodada e uma informacao que interessa aos dois lados: quem
  // respondeu quer saber que a proposta entrou na analise, e quem nao
  // respondeu precisa saber que o prazo passou — senao manda depois e a
  // recusa parece arbitraria. Fora da transacao, pelo mesmo motivo do
  // disparo. Cancelamento nao avisa: rodada cancelada e assunto interno.
  if (fim.ok && destinoStatus === 'encerrada' && c.canal !== 'portal') {
    emSegundoPlano(() => avisarEncerramento(c.id))
  }

  return fim
}
