import { NextResponse } from 'next/server'
import { um, ehPostgres } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Verificacao de saude para o orquestrador (Coolify / Docker healthcheck).
 * Responde 200 apenas se a aplicacao consegue de fato consultar o banco.
 */
export async function GET() {
  const inicio = Date.now()
  try {
    const r = await um<{ c: number | string }>('select count(*) c from empresas')
    const empresas = Number(r?.c ?? 0)
    if (empresas === 0) {
      return NextResponse.json(
        { estado: 'degradado', motivo: 'banco acessível, porém sem dados carregados' },
        { status: 503 })
    }
    return NextResponse.json({
      estado: 'ok',
      motor: ehPostgres() ? 'postgresql' : 'sqlite',
      empresas,
      latencia_ms: Date.now() - inicio,
    })
  } catch (e) {
    return NextResponse.json(
      { estado: 'erro', motivo: e instanceof Error ? e.message : 'falha ao consultar o banco' },
      { status: 503 })
  }
}
