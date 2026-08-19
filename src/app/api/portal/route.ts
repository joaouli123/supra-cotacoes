import { um } from '@/lib/db'
import { redirecionar } from '@/lib/http'

/**
 * Entrada no portal externo a partir de um token de convite.
 * O token e a credencial: identifica o fornecedor e fixa o contexto da sessao,
 * garantindo que a identificacao exibida e os dados da cotacao sejam sempre
 * do mesmo fornecedor.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token') ?? ''

  const convite = await um<{ fornecedor_id: number }>(
    'select fornecedor_id from cotacao_fornecedores where token = ?', [token])
  if (!convite) return redirecionar('/portal', 302)

  const res = redirecionar(`/portal/cotacao/${token}`, 302)
  const opcoes = { httpOnly: false, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 }
  res.cookies.set('supra_perfil', 'fornecedor', opcoes)
  res.cookies.set('supra_fornecedor', String(convite.fornecedor_id), opcoes)

  // elege um usuario do portal coerente, quando existir
  const u = await um<{ id: number }>(
    "select id from usuarios where perfil = 'fornecedor' and fornecedor_id = ? limit 1",
    [convite.fornecedor_id])
  if (u) res.cookies.set('supra_usuario', String(u.id), opcoes)
  return res
}
