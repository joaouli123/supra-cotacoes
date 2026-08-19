import { NextResponse } from 'next/server'
import { usuarioAutenticado } from '@/lib/sessao'

/**
 * Troca de contexto (empresa ativa e perfil de acesso).
 * Rota GET para funcionar sem JavaScript no cliente.
 *
 * Exige sessao: quem nao entrou nao troca contexto nenhum. Alternar o perfil
 * de acesso e prerrogativa do administrador da plataforma.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const atual = await usuarioAutenticado()
  if (!atual) return NextResponse.redirect(new URL('/entrar', url.origin))

  const empresa = url.searchParams.get('empresa')
  const perfil = url.searchParams.get('perfil')
  const voltar = url.searchParams.get('voltar') || '/painel'

  const destino = voltar.startsWith('/') && !voltar.startsWith('//') ? voltar : '/painel'
  const res = NextResponse.redirect(new URL(destino, url.origin))
  const opcoes = { httpOnly: false, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 7 }

  const ehAdmin = atual.perfil === 'admin_central'

  if (empresa && ehAdmin) res.cookies.set('supra_empresa', empresa, opcoes)
  if (perfil && ehAdmin) res.cookies.set('supra_perfil', perfil, opcoes)

  return res
}
