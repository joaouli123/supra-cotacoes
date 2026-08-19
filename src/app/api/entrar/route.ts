import { um } from '@/lib/db'
import { caminhoInterno, origemPropria, redirecionar } from '@/lib/http'
import { COOKIE_SESSAO, OPCOES_COOKIE_SESSAO, assinarCracha, conferirSenha } from '@/lib/auth'

/** Formulario nativo (method=post): funciona sem JavaScript no cliente. */

type Achado = { id: number; perfil: string; ativo: number; senha_hash: string | null }

// Freio simples de forca bruta, por IP. Memoria do processo: suficiente para
// uma instancia unica, que e como a aplicacao roda hoje.
const TENTATIVAS = new Map<string, { n: number; ate: number }>()
const LIMITE = 10
const JANELA = 5 * 60_000

function excedeu(ip: string): boolean {
  const agora = Date.now()
  // Varre os expirados antes de gravar: sem isso o mapa cresceria com um
  // registro por IP que ja tentou entrar, e nunca encolheria.
  if (TENTATIVAS.size > 512) {
    for (const [chave, v] of TENTATIVAS) if (v.ate < agora) TENTATIVAS.delete(chave)
  }
  const reg = TENTATIVAS.get(ip)
  if (!reg || reg.ate < agora) { TENTATIVAS.set(ip, { n: 1, ate: agora + JANELA }); return false }
  reg.n += 1
  return reg.n > LIMITE
}

export async function POST(req: Request) {
  // Formulario postado por outro site nao entra: evita que um terceiro
  // logue a vitima numa conta que ele controla.
  if (!origemPropria(req)) return redirecionar('/entrar?erro=origem')

  const form = await req.formData()
  const email = String(form.get('email') ?? '').trim()
  const senha = String(form.get('senha') ?? '')
  const voltar = caminhoInterno(String(form.get('voltar') ?? ''), '/painel')

  const falha = (motivo: string) =>
    redirecionar(`/entrar?erro=${motivo}&voltar=${encodeURIComponent(voltar)}`)

  if (!email || !senha) return falha('vazio')

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'
  if (excedeu(ip)) return falha('credencial')

  const u = await um<Achado>(
    `select id, perfil, ativo, senha_hash from usuarios
      where lower(email) = lower(?) and senha_hash is not null
      order by id limit 1`, [email])

  if (!u || !conferirSenha(senha, u.senha_hash)) return falha('credencial')
  if (!u.ativo) return falha('inativo')

  TENTATIVAS.delete(ip)

  const res = redirecionar(voltar)
  res.cookies.set(COOKIE_SESSAO, assinarCracha(u.id), OPCOES_COOKIE_SESSAO)
  // O perfil fica em cookie legivel porque a interface alterna de contexto por
  // ele; a autoridade continua sendo o cracha assinado, conferido no servidor.
  res.cookies.set('supra_perfil', u.perfil, {
    httpOnly: false, sameSite: 'lax', path: '/', maxAge: OPCOES_COOKIE_SESSAO.maxAge })
  res.cookies.delete('supra_empresa')
  res.cookies.delete('supra_fornecedor')
  return res
}
