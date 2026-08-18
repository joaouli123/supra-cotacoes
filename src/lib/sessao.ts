import { cookies } from 'next/headers'
import { um, todos } from './db'

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
  usuario: Usuario
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

export async function sessao(): Promise<Sessao> {
  const c = cookies()
  const perfil = (c.get('supra_perfil')?.value ?? 'gestor') as Perfil
  const idUsuario = Number(c.get('supra_usuario')?.value ?? 0)

  let usuario = idUsuario
    ? await um<Usuario>(`select id, empresa_id, fornecedor_id, nome, email, cargo, perfil
                           from usuarios where id = ?`, [idUsuario])
    : undefined
  if (!usuario || usuario.perfil !== perfil) usuario = await usuarioPadrao(perfil)

  // O administrador central pode navegar por qualquer empresa (troca de contexto).
  const idEmpresaCookie = Number(c.get('supra_empresa')?.value ?? 0)
  const idEmpresa = usuario.empresa_id ?? (idEmpresaCookie || null)

  const empresa = idEmpresa
    ? (await um<Empresa>(`select id,razao_social,nome_fantasia,cnpj,uf,cidade,segmento,plano
                            from empresas where id = ?`, [idEmpresa])) ?? null
    : null

  // No portal externo quem identifica o fornecedor e o token do convite:
  // ele e a credencial, e prevalece sobre o usuario da sessao.
  const idFornecedor = Number(c.get('supra_fornecedor')?.value ?? 0) || usuario.fornecedor_id
  const fornecedor = idFornecedor
    ? (await um<{ id: number; razao_social: string; nome_fantasia: string; cnpj: string }>(
        `select id, razao_social, nome_fantasia, cnpj from fornecedores where id = ?`,
        [idFornecedor])) ?? null
    : null

  return { usuario, empresa, fornecedor, perfil }
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

export function podeVer(perfil: Perfil, area: string): boolean {
  const mapa: Record<Perfil, string[]> = {
    admin_central: ['painel', 'cadastros', 'demandas', 'cotacoes', 'agendamentos', 'integracoes', 'auditoria', 'admin', 'arquitetura'],
    gestor:        ['painel', 'cadastros', 'demandas', 'cotacoes', 'agendamentos', 'integracoes', 'auditoria', 'arquitetura'],
    comprador:     ['painel', 'cadastros', 'demandas', 'cotacoes', 'arquitetura'],
    fornecedor:    ['portal'],
  }
  return mapa[perfil].includes(area)
}
