import { um } from '@/lib/db'
import { assinarValor } from '@/lib/auth'
import { redirecionar } from '@/lib/http'

/**
 * Entrada no portal externo a partir de um token de convite.
 *
 * O token e a credencial: identifica o fornecedor e fixa o contexto da
 * sessao. O resultado dessa checagem vai para um cookie assinado — o
 * navegador precisa le-lo para navegar, mas nao pode reescreve-lo para
 * apontar outro fornecedor.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token') ?? ''

  const convite = await um<{ fornecedor_id: number }>(
    'select fornecedor_id from cotacao_fornecedores where token = ?', [token])
  if (!convite) return redirecionar('/portal', 302)

  const res = redirecionar(`/portal/cotacao/${encodeURIComponent(token)}`, 302)
  res.cookies.set('supra_fornecedor', assinarValor(String(convite.fornecedor_id)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
