// =====================================================================
// Especificacao das entidades que o sistema grava.
//
// Cada entidade descreve seus campos uma unica vez. A partir dessa
// descricao saem tres coisas que precisam concordar entre si:
//
//   - o formulario (rotulo, tipo de campo, opcoes, obrigatoriedade)
//   - a validacao no servidor (nunca a do navegador, que o usuario controla)
//   - o SQL de insert/update e o registro de auditoria campo a campo
//
// Manter as tres derivadas da mesma fonte e o que impede o caso classico:
// campo novo aparece na tela, o servidor ignora, e a auditoria nao registra.
//
// Nada aqui usa a lista de campos vinda do formulario. O que nao esta
// descrito abaixo nao e gravado, mesmo que chegue no corpo da requisicao.
// =====================================================================
import type { Perfil, Area } from './sessao'
import { COND_PAGAMENTO } from './opcoes'
import {
  UFS, SEGMENTOS, MODAIS, ABRANGENCIAS, PLANOS, comoOpcoes,
} from './listas'

export type TipoCampo =
  | 'texto' | 'area' | 'email' | 'telefone' | 'documento'
  | 'inteiro' | 'decimal' | 'moeda'
  | 'select' | 'referencia' | 'booleano' | 'hora' | 'dias' | 'senha'

export type Opcao = { valor: string; rotulo: string }

export type Campo = {
  nome: string
  /** Coluna no banco, quando difere do nome do campo (ex.: senha → senha_hash). */
  coluna?: string
  rotulo: string
  tipo: TipoCampo
  obrigatorio?: boolean
  opcoes?: Opcao[]
  /** Chave da consulta que carrega as opcoes (ver `opcoesDe`). */
  fonte?: 'unidades' | 'classes' | 'empresas' | 'fornecedores' | 'materiais'
  min?: number
  max?: number
  passo?: number
  maxLen?: number
  ajuda?: string
  /** Largura na grade de 6 colunas do formulario. */
  col?: 2 | 3 | 4 | 6
  /** Nao pode ser alterado depois de criado (chave de negocio). */
  imutavel?: boolean
  padrao?: string
}

export type Especificacao = {
  chave: string
  tabela: string
  rotulo: string
  plural: string
  base: string
  area: Area
  /** Perfis autorizados a gravar. Ler e controlado por `podeVer`. */
  perfis: Perfil[]
  /**
   * empresa    — pertence a uma empresa; a coluna e obrigatoria
   * catalogo   — pode ser corporativo (empresa_id nulo) ou da empresa
   * plataforma — nao tem empresa (so o administrador central grava)
   */
  escopo: 'empresa' | 'catalogo' | 'plataforma'
  campos: Campo[]
  /** Coluna que identifica o registro na trilha de auditoria. */
  rotuloColuna: string
  /** Colunas com restricao de unicidade, checadas antes de gravar. */
  unicos?: string[]
  temAtivo?: boolean
  temCriadoEm?: boolean
  temAtualizadoEm?: boolean
  /** Permite apagar de vez (alem de inativar). */
  exclusaoFisica?: boolean
  /**
   * Vinculos a soltar antes de apagar: o historico que aponta para o registro
   * fica, sem a referencia. Bloquear a exclusao por causa de um log de envio
   * seria pior — o log nao e o dado, e so a lembranca dele.
   */
  limparReferencias?: Array<{ tabela: string; coluna: string }>
  /** Existe pagina de detalhe em `${base}/${id}`. */
  temDetalhe?: boolean
  /**
   * Colunas obrigatorias no banco que o formulario nao pede porque saem dos
   * outros campos. Sem isso o insert falharia por not null — e pedir o valor
   * ao usuario seria pedir que ele calcule o que o sistema ja sabe.
   */
  derivar?: (v: Record<string, string | number | null>) => Record<string, string | number | null>
}

/** Proxima ocorrencia de `horario` num dos `dias`, a partir de agora. */
export function proximoDisparo(dias: string, horario: string): string {
  const ordem = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const alvo = new Set(dias.split(',').map((d) => d.trim()).filter(Boolean))
  const [h, m] = horario.split(':').map(Number)

  const d = new Date()
  d.setSeconds(0, 0)
  // Ate 8 tentativas: 7 dias da semana mais o caso de hoje ja ter passado.
  for (let i = 0; i < 8; i++) {
    const c = new Date(d)
    c.setDate(d.getDate() + i)
    c.setHours(h || 0, m || 0, 0, 0)
    if (c > d && alvo.has(ordem[c.getDay()])) return c.toISOString()
  }
  return new Date(d.getTime() + 86_400_000).toISOString()
}

const CAMPO_ATIVO: Campo = {
  nome: 'ativo', rotulo: 'Situação', tipo: 'booleano', col: 2, padrao: '1',
  opcoes: [{ valor: '1', rotulo: 'Ativo' }, { valor: '0', rotulo: 'Inativo' }],
  ajuda: 'Registros inativos somem das listagens e das cotações, mas continuam na base e na auditoria.',
}

const UF: Campo = { nome: 'uf', rotulo: 'UF', tipo: 'select', obrigatorio: true, col: 2, opcoes: comoOpcoes(UFS) }
const CIDADE: Campo = { nome: 'cidade', rotulo: 'Cidade', tipo: 'texto', obrigatorio: true, maxLen: 80, col: 4 }
const CNPJ: Campo = {
  nome: 'cnpj', rotulo: 'CNPJ', tipo: 'documento', obrigatorio: true, maxLen: 18, col: 3,
  ajuda: 'Somente os 14 dígitos; a formatação é aplicada ao gravar.',
}
const EMAIL: Campo = { nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, maxLen: 120, col: 3 }
const TELEFONE: Campo = { nome: 'telefone', rotulo: 'Telefone', tipo: 'telefone', obrigatorio: true, maxLen: 20, col: 3 }

/* ------------------------------------------------------------ Materiais */
const MATERIAIS: Especificacao = {
  chave: 'materiais', tabela: 'materiais', rotulo: 'Material', plural: 'Materiais',
  base: '/materiais', area: 'cadastros', perfis: ['admin_central', 'gestor', 'comprador'],
  escopo: 'catalogo', rotuloColuna: 'descricao', unicos: ['codigo'],
  temAtivo: true, temCriadoEm: true, temAtualizadoEm: true, temDetalhe: true,
  campos: [
    { nome: 'codigo', rotulo: 'Código', tipo: 'texto', obrigatorio: true, maxLen: 24, col: 2,
      imutavel: true, ajuda: 'Chave do item no ERP. Não muda depois de criado.' },
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto', obrigatorio: true, maxLen: 160, col: 4 },
    { nome: 'especificacao', rotulo: 'Especificação técnica', tipo: 'area', maxLen: 600, col: 6 },
    { nome: 'classificacao_id', rotulo: 'Classificação (nível 5)', tipo: 'referencia',
      fonte: 'classes', obrigatorio: true, col: 4 },
    { nome: 'unidade_id', rotulo: 'Unidade', tipo: 'referencia', fonte: 'unidades', obrigatorio: true, col: 2 },
    { nome: 'ncm', rotulo: 'NCM', tipo: 'texto', maxLen: 12, col: 2 },
    { nome: 'preco_referencia', rotulo: 'Preço de referência', tipo: 'moeda',
      obrigatorio: true, min: 0, max: 99_999_999, col: 2,
      ajuda: 'Base de comparação da equalização.' },
    { nome: 'curva', rotulo: 'Curva ABC', tipo: 'select', obrigatorio: true, col: 2, opcoes: [
      { valor: 'A', rotulo: 'A — alto valor' },
      { valor: 'B', rotulo: 'B — valor médio' },
      { valor: 'C', rotulo: 'C — baixo valor' }] },
    { nome: 'estoque_minimo', rotulo: 'Estoque mínimo', tipo: 'decimal', min: 0, max: 9_999_999, col: 2,
      ajuda: 'Abaixo disso o item entra na reposição automática.' },
    CAMPO_ATIVO,
  ],
}

/* --------------------------------------------------------- Fornecedores */
const FORNECEDORES: Especificacao = {
  chave: 'fornecedores', tabela: 'fornecedores', rotulo: 'Fornecedor', plural: 'Fornecedores',
  base: '/fornecedores', area: 'cadastros', perfis: ['admin_central', 'gestor', 'comprador'],
  escopo: 'catalogo', rotuloColuna: 'razao_social', unicos: ['cnpj'],
  temAtivo: true, temCriadoEm: true, temAtualizadoEm: true, temDetalhe: true,
  campos: [
    { nome: 'razao_social', rotulo: 'Razão social', tipo: 'texto', obrigatorio: true, maxLen: 140, col: 4 },
    { nome: 'nome_fantasia', rotulo: 'Nome fantasia', tipo: 'texto', obrigatorio: true, maxLen: 90, col: 2 },
    CNPJ, EMAIL,
    { nome: 'contato', rotulo: 'Pessoa de contato', tipo: 'texto', obrigatorio: true, maxLen: 90, col: 3 },
    TELEFONE, CIDADE, UF,
    { nome: 'cond_pagamento', rotulo: 'Condição de pagamento padrão', tipo: 'select',
      obrigatorio: true, col: 3, opcoes: COND_PAGAMENTO.map(([r]) => ({ valor: r, rotulo: r })) },
    { nome: 'prazo_entrega_dias', rotulo: 'Prazo de entrega (dias)', tipo: 'inteiro',
      obrigatorio: true, min: 1, max: 365, col: 3 },
    { nome: 'avaliacao', rotulo: 'Avaliação', tipo: 'decimal', obrigatorio: true,
      min: 0, max: 5, passo: 0.1, col: 2, ajuda: 'De 0 a 5, por histórico de entregas.' },
    { nome: 'homologado', rotulo: 'Homologação', tipo: 'booleano', col: 2, padrao: '1',
      opcoes: [{ valor: '1', rotulo: 'Homologado' }, { valor: '0', rotulo: 'Em análise' }],
      ajuda: 'Somente fornecedores homologados podem ser convidados para cotações.' },
    CAMPO_ATIVO,
  ],
}

/* -------------------------------------------------------------- Clientes */
const CLIENTES: Especificacao = {
  chave: 'clientes', tabela: 'clientes', rotulo: 'Cliente', plural: 'Clientes',
  base: '/clientes', area: 'cadastros', perfis: ['admin_central', 'gestor', 'comprador'],
  escopo: 'empresa', rotuloColuna: 'razao_social', unicos: ['cnpj'],
  temAtivo: true, temCriadoEm: true, temAtualizadoEm: true,
  campos: [
    { nome: 'razao_social', rotulo: 'Razão social', tipo: 'texto', obrigatorio: true, maxLen: 140, col: 4 },
    { nome: 'nome_fantasia', rotulo: 'Nome fantasia', tipo: 'texto', obrigatorio: true, maxLen: 90, col: 2 },
    CNPJ, EMAIL,
    { nome: 'contato', rotulo: 'Pessoa de contato', tipo: 'texto', obrigatorio: true, maxLen: 90, col: 3 },
    TELEFONE, CIDADE, UF,
    { nome: 'segmento', rotulo: 'Segmento', tipo: 'select', obrigatorio: true, col: 4,
      opcoes: comoOpcoes(SEGMENTOS) },
    CAMPO_ATIVO,
  ],
}

/* ------------------------------------------------------ Transportadoras */
const TRANSPORTADORAS: Especificacao = {
  chave: 'transportadoras', tabela: 'transportadoras', rotulo: 'Transportadora', plural: 'Transportadoras',
  base: '/transportadoras', area: 'cadastros', perfis: ['admin_central', 'gestor', 'comprador'],
  escopo: 'catalogo', rotuloColuna: 'razao_social', unicos: ['cnpj'],
  temAtivo: true, temCriadoEm: true, temAtualizadoEm: true,
  campos: [
    { nome: 'razao_social', rotulo: 'Razão social', tipo: 'texto', obrigatorio: true, maxLen: 140, col: 4 },
    { nome: 'nome_fantasia', rotulo: 'Nome fantasia', tipo: 'texto', obrigatorio: true, maxLen: 90, col: 2 },
    CNPJ, EMAIL, TELEFONE, CIDADE, UF,
    { nome: 'modal', rotulo: 'Modal', tipo: 'select', obrigatorio: true, col: 3, opcoes: comoOpcoes(MODAIS) },
    { nome: 'abrangencia', rotulo: 'Abrangência', tipo: 'select', obrigatorio: true, col: 3,
      opcoes: comoOpcoes(ABRANGENCIAS) },
    { nome: 'prazo_medio_dias', rotulo: 'Prazo médio (dias)', tipo: 'inteiro',
      obrigatorio: true, min: 1, max: 120, col: 2 },
    CAMPO_ATIVO,
  ],
}

/* --------------------------------------------------------- Agendamentos */
const AGENDAMENTOS: Especificacao = {
  chave: 'agendamentos', tabela: 'agendamentos', rotulo: 'Disparo programado', plural: 'Disparos programados',
  base: '/agendamentos', area: 'agendamentos', perfis: ['admin_central', 'gestor'],
  escopo: 'empresa', rotuloColuna: 'nome',
  temAtivo: true, temCriadoEm: true, exclusaoFisica: true,
  limparReferencias: [{ tabela: 'disparo_logs', coluna: 'agendamento_id' }],
  derivar: (v) => ({
    proximo_disparo: proximoDisparo(String(v.dias_semana ?? ''), String(v.horario ?? '08:00')),
  }),
  campos: [
    { nome: 'nome', rotulo: 'Nome da rodada', tipo: 'texto', obrigatorio: true, maxLen: 90, col: 6,
      ajuda: 'Aparece no histórico de disparos, então vale ser específico.' },
    { nome: 'dias_semana', rotulo: 'Dias da semana', tipo: 'dias', obrigatorio: true, col: 6 },
    { nome: 'horario', rotulo: 'Horário', tipo: 'hora', obrigatorio: true, col: 2 },
    { nome: 'canal', rotulo: 'Canal', tipo: 'select', obrigatorio: true, col: 2, opcoes: [
      { valor: 'email', rotulo: 'E-mail' },
      { valor: 'portal', rotulo: 'Portal' },
      { valor: 'ambos', rotulo: 'E-mail e portal' }] },
    { nome: 'janela_resposta_horas', rotulo: 'Janela de resposta (horas)', tipo: 'inteiro',
      obrigatorio: true, min: 1, max: 720, col: 2,
      ajuda: 'Tempo que o fornecedor tem para responder antes de o convite expirar.' },
    CAMPO_ATIVO,
  ],
}

/* -------------------------------------------------------------- Empresas */
const EMPRESAS: Especificacao = {
  chave: 'empresas', tabela: 'empresas', rotulo: 'Empresa', plural: 'Empresas',
  base: '/empresas', area: 'admin', perfis: ['admin_central'],
  escopo: 'plataforma', rotuloColuna: 'nome_fantasia', unicos: ['cnpj'],
  temAtivo: true, temCriadoEm: true,
  campos: [
    { nome: 'razao_social', rotulo: 'Razão social', tipo: 'texto', obrigatorio: true, maxLen: 140, col: 4 },
    { nome: 'nome_fantasia', rotulo: 'Nome fantasia', tipo: 'texto', obrigatorio: true, maxLen: 90, col: 2 },
    CNPJ, CIDADE, UF,
    { nome: 'segmento', rotulo: 'Segmento', tipo: 'select', obrigatorio: true, col: 3,
      opcoes: comoOpcoes(SEGMENTOS) },
    { nome: 'plano', rotulo: 'Plano', tipo: 'select', obrigatorio: true, col: 3,
      opcoes: comoOpcoes(PLANOS) },
    CAMPO_ATIVO,
  ],
}

/* -------------------------------------------------------------- Usuarios */
const USUARIOS: Especificacao = {
  chave: 'usuarios', tabela: 'usuarios', rotulo: 'Usuário', plural: 'Usuários',
  base: '/usuarios', area: 'usuarios', perfis: ['admin_central', 'gestor'],
  escopo: 'empresa', rotuloColuna: 'nome', unicos: ['email'],
  temAtivo: true,
  campos: [
    { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, maxLen: 90, col: 3 },
    { nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true, maxLen: 120, col: 3 },
    { nome: 'cargo', rotulo: 'Cargo', tipo: 'texto', obrigatorio: true, maxLen: 60, col: 3 },
    { nome: 'perfil', rotulo: 'Perfil de acesso', tipo: 'select', obrigatorio: true, col: 3, opcoes: [
      { valor: 'gestor', rotulo: 'Gestor de suprimentos' },
      { valor: 'comprador', rotulo: 'Comprador' }] },
    { nome: 'telefone', rotulo: 'Telefone', tipo: 'telefone', maxLen: 20, col: 3 },
    { nome: 'senha', coluna: 'senha_hash', rotulo: 'Senha de acesso', tipo: 'senha', col: 3,
      ajuda: 'Mínimo de 8 caracteres. Ao editar, deixe em branco para manter a senha atual.' },
    CAMPO_ATIVO,
  ],
}

export const REGISTROS: Record<string, Especificacao> = {
  materiais: MATERIAIS,
  fornecedores: FORNECEDORES,
  clientes: CLIENTES,
  transportadoras: TRANSPORTADORAS,
  agendamentos: AGENDAMENTOS,
  empresas: EMPRESAS,
  usuarios: USUARIOS,
}

export function specDe(chave: string): Especificacao | null {
  return Object.prototype.hasOwnProperty.call(REGISTROS, chave) ? REGISTROS[chave] : null
}

export function campoDe(spec: Especificacao, nome: string): Campo | undefined {
  return spec.campos.find((c) => c.nome === nome)
}

/** Perfil tem direito de gravar nesta entidade? */
export function podeGravar(spec: Especificacao, perfil: Perfil): boolean {
  return spec.perfis.includes(perfil)
}
