import { NextResponse } from 'next/server'
import { um } from '@/lib/db'
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
  const reg = TENTATIVAS.get(ip)
  if (!reg || reg.ate < agora) { TENTATIVAS.set(ip, { n: 1, ate: agora + JANELA }); return false }
  reg.n += 1
  return reg.n > LIMITE
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const form = await req.formData()
  const email = String(form.get('email') ?? '').trim()
  const senha = String(form.get('senha') ?? '')
  const bruto = String(form.get('voltar') ?? '/painel')
  const voltar = bruto.startsWith('/') && !bruto.startsWith('//') ? bruto : '/painel'

  const falha = (motivo: string) =>
    NextResponse.redirect(
      new URL(`/entrar?erro=${motivo}&voltar=${encodeURIComponent(voltar)}`, url.origin), 303)

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

  const res = NextResponse.redirect(new URL(voltar, url.origin), 303)
  res.cookies.set(COOKIE_SESSAO, assinarCracha(u.id), OPCOES_COOKIE_SESSAO)
  // O perfil fica em cookie legivel porque a interface alterna de contexto por
  // ele; a autoridade continua sendo o cracha assinado, conferido no servidor.
  res.cookies.set('supra_perfil', u.perfil, {
    httpOnly: false, sameSite: 'lax', path: '/', maxAge: OPCOES_COOKIE_SESSAO.maxAge })
  res.cookies.delete('supra_empresa')
  res.cookies.delete('supra_fornecedor')
  return res
}
