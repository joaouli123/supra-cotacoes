import { NextResponse } from 'next/server'

/**
 * Redirecionamento com Location relativo.
 *
 * Atras do proxy reverso o req.url visto pelo Next carrega o endereco interno
 * do container (0.0.0.0:3000), entao qualquer URL absoluta montada a partir
 * dele manda o navegador para um host que nao existe. O HTTP admite Location
 * relativo, que o proprio navegador resolve contra o endereco realmente
 * acessado — e nao depende de confiar em cabecalhos X-Forwarded-*.
 */
export function redirecionar(destino: string, status: 302 | 303 | 307 = 303) {
  return new NextResponse(null, { status, headers: { location: destino } })
}

/** Aceita apenas caminhos internos, barrando redirecionamento para fora. */
export function caminhoInterno(bruto: string | null | undefined, padrao: string): string {
  if (!bruto) return padrao
  return bruto.startsWith('/') && !bruto.startsWith('//') ? bruto : padrao
}
