import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { um, todos } from './db'
import { COOKIE_SESSAO, lerCracha, lerValor } from './auth'

export type Perfil = 'admin_central' | 'gestor' | 'comprador' | 'fornecedor'

export type Empresa = {
  id: number; razao_social: string; nome_fantasia: string; cnpj: string
  uf: string; cidade: string; segmento: string; plano: string
}
export type Usuario = {
  id: number; empresa_id: number | null; fornecedor_id: number | null
  nome: string; email: string; cargo: string; perfil: Perfil
}
export type Sessao = {
  /** Usuario exibido na tela: o autenticado, ou um representante do perfil simulado. */
  usuario: Usuario
  /** Quem de fato entrou com e-mail e senha. Nulo apenas no portal do fornecedor. */
  autenticado: Usuario | null
  /** Verdadeiro quando o administrador esta vendo a plataforma por outro perfil. */
  simulando: boolean
  empresa: Empresa | null
  fornecedor: { id: number; razao_social: string; nome_fantasia: string; cnpj: string } | null
  perfil: Perfil
}

export const ROTULO_PERFIL: Record<Perfil, string> = {
  admin_central: 'Administrador da plataforma',
  gestor: 'Gestor de suprimentos',
  comprador: 'Comprador',
  fornecedor: 'Fornecedor (portal externo)',
}

/** Usuario padrao de cada perfil, usado quando nao ha escolha na sessao. */
async function usuarioPadrao(perfil: Perfil): Promise<Usuario> {
  const u = await um<Usuario>(
    `select id, empresa_id, fornecedor_id, nome, email, cargo, perfil
       from usuarios where perfil = ? and ativo = 1 order by id limit 1`, [perfil]
  )
  if (!u) throw new Error(`Nenhum usuário com perfil ${perfil} na base.`)
  return u
}

const PERFIS: Perfil[] = ['admin_central', 'gestor', 'comprador', 'fornecedor']

/** Usuario do cracha assinado. E a unica fonte de identidade confiavel. */
export async function usuarioAutenticado(): Promise<Usuario | null> {
  const id = lerCracha(cookies().get(COOKIE_SESSAO)?.value)
  if (!id) return null
  return (await um<Usuario>(
    `select id, empresa_id, fornecedor_id, nome, email, cargo, perfil
       from usuarios where id = ? and ativo = 1`, [id])) ?? null
}

/**
 * Contexto da requisicao.
 *
 * Por padrao exige sessao autenticada e redireciona para a tela de entrada.
 * O portal externo passa `publico: true`: la quem identifica o fornecedor e o
 * token do convite, que e a propria credencial, sem login.
 */
export async function sessao(opcoes: { publico?: boolean } = {}): Promise<Sessao> {
  const c = cookies()
  const autenticado = await usuarioAutenticado()

  if (!autenticado && !opcoes.publico) redirect('/entrar')

  const ehAdmin = autenticado?.perfil === 'admin_central'

  const pedido = c.get('supra_perfil')?.value as Perfil | undefined
  const desejado = pedido && PERFIS.includes(pedido) ? pedido : undefined

  // Somente o administrador da plataforma enxerga por outro perfil. Os demais
  // ficam presos ao proprio e o visitante do portal e sempre fornecedor: os
  // cookies de contexto nao sao httpOnly, entao nao valem como credencial.
  const perfil: Perfil = autenticado
    ? (ehAdmin ? desejado ?? 'admin_central' : autenticado.perfil)
    : 'fornecedor'

  const simulando = !!autenticado && perfil !== autenticado.perfil
  const usuario = autenticado && !simulando ? autenticado : await usuarioPadrao(perfil)

  // A troca de empresa e prerrogativa do administrador central; para os demais
  // vale a empresa gravada no proprio cadastro, e so ela.
  const idEmpresaCookie = ehAdmin ? Number(c.get('supra_empresa')?.value ?? 0) || null : null
  const idEmpresa = usuario.empresa_id ?? idEmpresaCookie

  const empresa = idEmpresa
    ? (await um<Empresa>(`select id,razao_social,nome_fantasia,cnpj,uf,cidade,segmento,plano
                            from empresas where id = ?`, [idEmpresa])) ?? null
    : null

  // No portal externo quem identifica o fornecedor e o token do convite. O
  // cookie que guarda esse resultado e assinado em /api/portal: sem a
  // assinatura, qualquer visitante trocaria o numero e leria as cotacoes de
  // outro fornecedor. Vinculo do proprio cadastro sempre tem precedencia.
  // Visitante sem convite valido nao tem fornecedor nenhum: cair no vinculo do
  // usuario representante do perfil exibiria as cotacoes de um fornecedor real
  // para quem so abriu o endereco do portal.
  const doConvite = Number(lerValor(c.get('supra_fornecedor')?.value) ?? 0) || null
  const idFornecedor = autenticado ? autenticado.fornecedor_id ?? doConvite : doConvite
  const fornecedor = idFornecedor
    ? (await um<{ id: number; razao_social: string; nome_fantasia: string; cnpj: string }>(
        `select id, razao_social, nome_fantasia, cnpj from fornecedores where id = ?`,
        [idFornecedor])) ?? null
    : null

  return { usuario, autenticado, simulando, empresa, fornecedor, perfil }
}

export async function empresas(): Promise<Empresa[]> {
  return await todos<Empresa>(
    `select id,razao_social,nome_fantasia,cnpj,uf,cidade,segmento,plano
       from empresas where ativo = 1 order by nome_fantasia`
  )
}

/**
 * Clausula de isolamento multiempresa.
 * Cadastros com empresa_id nulo pertencem ao catalogo corporativo e sao
 * visiveis por todas as empresas; os demais somente pela empresa dona.
 */
export function filtroEmpresa(idEmpresa: number | null, alias = '', compartilhavel = true) {
  const col = alias ? `${alias}.empresa_id` : 'empresa_id'
  if (idEmpresa === null) return { sql: '1=1', params: [] as number[] }
  return compartilhavel
    ? { sql: `(${col} is null or ${col} = ?)`, params: [idEmpresa] }
    : { sql: `${col} = ?`, params: [idEmpresa] }
}

export type Area =
  | 'painel' | 'cadastros' | 'demandas' | 'cotacoes' | 'agendamentos'
  | 'integracoes' | 'auditoria' | 'admin' | 'arquitetura' | 'portal'

export function podeVer(perfil: Perfil, area: Area): boolean {
  const mapa: Record<Perfil, Area[]> = {
    admin_central: ['painel', 'cadastros', 'demandas', 'cotacoes', 'agendamentos', 'integracoes', 'auditoria', 'admin', 'arquitetura'],
    gestor:        ['painel', 'cadastros', 'demandas', 'cotacoes', 'agendamentos', 'integracoes', 'auditoria', 'arquitetura'],
    comprador:     ['painel', 'cadastros', 'demandas', 'cotacoes', 'arquitetura'],
    fornecedor:    ['portal'],
  }
  return mapa[perfil].includes(area)
}
