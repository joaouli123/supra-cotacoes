import Link from 'next/link'
import { sessao } from '@/lib/sessao'
import { iniciais } from '@/lib/formato'

export const dynamic = 'force-dynamic'

/**
 * Shell do portal externo. Deliberadamente distinto do ambiente interno:
 * o fornecedor nao ve navegacao, cadastros nem qualquer dado de outras empresas.
 */
export default async function LayoutPortal({ children }: { children: React.ReactNode }) {
  const s = await sessao({ publico: true })
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="h-14 bg-white border-b border-ink-200 sticky top-0 z-20">
        <div className="mx-auto max-w-[1200px] h-full px-6 flex items-center gap-4">
          <Link href="/portal" className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded bg-ink-900 text-white grid place-items-center text-[11px] font-bold">S</span>
            <span className="text-sm font-semibold tracking-tight">SUPRA</span>
            <span className="text-2xs uppercase tracking-wider text-ink-400 border-l border-ink-200 pl-2.5 ml-1">
              Portal do fornecedor
            </span>
          </Link>
          <div className="flex-1" />
          {s.fornecedor ? (
            <div className="flex items-center gap-2.5">
              <span className="hidden sm:block text-right leading-tight">
                <span className="block text-xs font-medium text-ink-900 max-w-[240px] truncate">{s.fornecedor.razao_social}</span>
                <span className="block text-2xs texto-mono text-ink-500">{s.fornecedor.cnpj}</span>
              </span>
              <span className="w-7 h-7 rounded-full bg-ink-900 text-white grid place-items-center text-[10px] font-semibold">
                {iniciais(s.fornecedor.nome_fantasia)}
              </span>
            </div>
          ) : (
            <span className="text-xs text-ink-500">Acesso por convite</span>
          )}
          <Link href="/" className="btn btn-sutil btn-sm ml-1">Sair</Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-6 py-8">{children}</main>
      <footer className="mx-auto max-w-[1200px] px-6 py-6 text-2xs text-ink-400 border-t border-ink-200 mt-8">
        Ambiente externo. O fornecedor acessa exclusivamente as cotações para as quais foi convidado —
        não há visibilidade sobre a base interna, outros fornecedores ou demais empresas da plataforma.
      </footer>
    </div>
  )
}
