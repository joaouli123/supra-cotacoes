import { NextResponse } from 'next/server'
import { um } from '@/lib/db'

/**
 * Troca de contexto da demonstracao (empresa ativa e perfil de acesso).
 * Implementado como rota GET para funcionar sem JavaScript no cliente.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const empresa = url.searchParams.get('empresa')
  const perfil = url.searchParams.get('perfil')
  const usuario = url.searchParams.get('usuario')
  const voltar = url.searchParams.get('voltar') || '/painel'

  const destino = voltar.startsWith('/') ? voltar : '/painel'
  const res = NextResponse.redirect(new URL(destino, url.origin))
  const opcoes = { httpOnly: false, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 }

  if (empresa) res.cookies.set('supra_empresa', empresa, opcoes)

  if (perfil) {
    res.cookies.set('supra_perfil', perfil, opcoes)
    const alvo = usuario
      ? await um<{ id: number }>('select id from usuarios where id = ? and perfil = ?', [Number(usuario), perfil])
      : await um<{ id: number }>(
          `select id from usuarios where perfil = ? and ativo = 1 order by id limit 1`, [perfil])
    if (alvo) res.cookies.set('supra_usuario', String(alvo.id), opcoes)
  } else if (usuario) {
    res.cookies.set('supra_usuario', usuario, opcoes)
  }
  return res
}
