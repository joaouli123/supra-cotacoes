// =====================================================================
// Guardas de autorizacao das paginas.
//
// A barra lateral ja esconde o que cada perfil nao usa, mas esconder link
// nao e controle de acesso: o endereco continua digitavel. Toda pagina de
// dentro do sistema passa por `exigir`, e as paginas de detalhe passam
// tambem por `exigirEmpresa`, para que trocar o id na URL nao atravesse a
// fronteira entre inquilinos.
//
// A recusa e 404, nao 403: para quem nao pode ver, a pagina simplesmente
// nao existe — nao confirmamos nem o endereco nem o registro.
// =====================================================================
import { notFound } from 'next/navigation'
import { sessao, podeVer, type Area, type Sessao } from './sessao'

/** Sessao autenticada com direito a area. Redireciona ou 404 quando nao. */
export async function exigir(area: Area): Promise<Sessao> {
  const s = await sessao()
  if (!podeVer(s.perfil, area)) notFound()
  return s
}

/**
 * Confina um registro a empresa da sessao.
 *
 * `compartilhavel` marca os cadastros de catalogo corporativo (empresa_id
 * nulo), visiveis por todas as empresas — mesma regra de `filtroEmpresa`.
 */
export function exigirEmpresa(
  s: Sessao,
  idEmpresaDoRegistro: number | null,
  compartilhavel = false
): void {
  if (s.autenticado?.perfil === 'admin_central') return
  if (compartilhavel && idEmpresaDoRegistro === null) return
  if (!s.empresa || s.empresa.id !== idEmpresaDoRegistro) notFound()
}
