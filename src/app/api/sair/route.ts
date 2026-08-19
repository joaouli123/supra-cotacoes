import { NextResponse } from 'next/server'
import { COOKIE_SESSAO } from '@/lib/auth'

/** Encerrar sessao e POST de proposito: link nao derruba a sessao por prefetch. */
export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/entrar', new URL(req.url).origin), 303)
  for (const c of [COOKIE_SESSAO, 'supra_perfil', 'supra_usuario', 'supra_empresa', 'supra_fornecedor']) {
    res.cookies.set(c, '', { path: '/', maxAge: 0 })
  }
  return res
}
