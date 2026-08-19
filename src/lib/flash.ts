// =====================================================================
// Recado de uma requisicao para a proxima.
//
// O formulario e HTML puro: quando a validacao recusa, quem responde e um
// redirecionamento, e redirecionamento nao carrega corpo. Sem isso a pessoa
// voltaria para a tela em branco e digitaria tudo de novo — que e o defeito
// que faz um sistema parecer prototipo.
//
// O recado vai num cookie de vida curta, carimbado com um numero unico que
// tambem viaja na URL. Sem o carimbo bater, o recado e ignorado: assim um
// erro de dez segundos atras nao reaparece na proxima vez que a tela for
// aberta.
// =====================================================================
import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import type { Erros, Valores } from './gravar'

const NOME = 'supra_form'
/** Teto conservador: navegador nenhum garante mais de 4 KB por cookie. */
const LIMITE = 3400

export type Recado = { erros: Erros; valores: Valores }

/**
 * Guarda erros e valores digitados e devolve o carimbo a colocar na URL.
 * Se o conteudo nao couber, os erros tem precedencia sobre os valores: sem
 * eles a tela nao explica o que houve.
 */
export function guardarRecado(res: NextResponse, erros: Erros, valores: Valores): string {
  const carimbo = randomUUID().slice(0, 8)
  let corpo = JSON.stringify({ c: carimbo, e: erros, v: valores })
  if (corpo.length > LIMITE) corpo = JSON.stringify({ c: carimbo, e: erros, v: {} })
  if (corpo.length > LIMITE) corpo = JSON.stringify({ c: carimbo, e: { _: 'Não foi possível gravar.' }, v: {} })

  res.cookies.set(NOME, corpo, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 120,
  })
  return carimbo
}

/** Le o recado se o carimbo da URL for o mesmo que o do cookie. */
export function lerRecado(carimbo: string | undefined): Recado | null {
  if (!carimbo) return null
  const cru = cookies().get(NOME)?.value
  if (!cru) return null
  try {
    const d = JSON.parse(cru) as { c?: string; e?: Erros; v?: Valores }
    if (d.c !== carimbo) return null
    return { erros: d.e ?? {}, valores: d.v ?? {} }
  } catch {
    return null
  }
}
