import { COOKIE_SESSAO } from '@/lib/auth'
import { redirecionar } from '@/lib/http'

/** Encerrar sessao e POST de proposito: link nao derruba a sessao por prefetch. */
export async function POST() {
  const res = redirecionar('/entrar')
  for (const c of [COOKIE_SESSAO, 'supra_perfil', 'supra_usuario', 'supra_empresa', 'supra_fornecedor']) {
    res.cookies.set(c, '', { path: '/', maxAge: 0 })
  }
  return res
}
