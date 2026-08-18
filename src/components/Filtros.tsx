'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useRef } from 'react'
import { IconeBusca, IconeFechar, IconeLimpar, IconeRaio } from './icones'

export type Opcao = { valor: string; rotulo: string }
export type Select = { nome: string; valor: string; vazio: string; opcoes: Opcao[]; rotulo?: string }

/**
 * Barra de filtros. Funciona como formulario GET (mantem o estado na URL,
 * permite compartilhar e voltar no navegador) e, com JavaScript disponivel,
 * aplica o filtro assim que o usuario troca uma opcao.
 */
export function Filtros({ acao, busca, placeholder, selects = [], extra }: {
  acao: string
  busca?: string
  placeholder?: string
  selects?: Select[]
  extra?: React.ReactNode
}) {
  const form = useRef<HTMLFormElement>(null)
  const router = useRouter()
  const params = useSearchParams()
  const caminho = usePathname()

  const ativos: Array<{ nome: string; rotulo: string; valor: string }> = []
  if (busca) ativos.push({ nome: 'q', rotulo: 'Busca', valor: `"${busca}"` })
  for (const s of selects) {
    if (!s.valor) continue
    const op = s.opcoes.find((o) => o.valor === s.valor)
    ativos.push({ nome: s.nome, rotulo: s.rotulo ?? s.vazio.replace(/^(Todos|Todas|Toda|Qualquer)\s+(os|as|a)?\s*/i, ''), valor: op?.rotulo ?? s.valor })
  }

  const remover = (nome: string) => {
    const p = new URLSearchParams(params.toString())
    p.delete(nome); p.delete('pagina')
    const qs = p.toString()
    router.push(qs ? `${caminho}?${qs}` : caminho)
  }

  return (
    <div className="mb-4">
      <form ref={form} action={acao} method="get"
            className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
        {/* a paginacao reinicia sempre que o filtro muda */}
        <input type="hidden" name="pagina" value="1" />

        <div className="relative col-span-2 sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none">
            <IconeBusca size={15} />
          </span>
          <input type="search" name="q" defaultValue={busca} placeholder={placeholder ?? 'Buscar…'}
                 aria-label={placeholder ?? 'Buscar'} autoComplete="off"
                 className="campo pl-9" />
        </div>

        {selects.map((s) => (
          <select key={s.nome} name={s.nome} defaultValue={s.valor}
                  aria-label={s.vazio}
                  onChange={() => form.current?.requestSubmit()}
                  className={`campo w-full sm:w-auto sm:min-w-[145px] sm:max-w-[220px] ${
                    s.valor ? 'border-ink-400 text-ink-900 font-medium' : ''}`}>
            <option value="">{s.vazio}</option>
            {s.opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        ))}

        {/* no celular o filtro e aplicado na troca da opcao e no Enter da busca */}
        <button type="submit" className="btn btn-secundario hidden sm:inline-flex">
          <IconeBusca size={15} />Filtrar
        </button>
        {extra}
      </form>

      {ativos.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          <span className="hidden sm:inline text-2xs uppercase tracking-wider font-semibold text-ink-400 mr-0.5">
            Filtros ativos
          </span>
          {ativos.map((a) => (
            <span key={a.nome} className="chip">
              <span className="text-ink-500">{a.rotulo}:</span>
              <span className="font-medium truncate max-w-[180px]">{a.valor}</span>
              <button type="button" onClick={() => remover(a.nome)}
                      aria-label={`Remover filtro ${a.rotulo}`} className="chip-x">
                <IconeFechar size={11} />
              </button>
            </span>
          ))}
          <a href={acao} className="btn btn-sutil btn-sm text-ink-500 h-7 px-2">
            <IconeLimpar size={13} />Limpar
          </a>
        </div>
      )}
    </div>
  )
}

/** Selo com o tempo real gasto na consulta ao banco. */
export function TempoConsulta({ ms, registros }: { ms: number; registros: number }) {
  const n = (v: number) => v.toLocaleString('pt-BR')
  const t = ms < 10
    ? ms.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n(Math.round(ms))
  return (
    <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-ink-200
                     bg-ink-50 text-2xs text-ink-500 tabular whitespace-nowrap">
      <IconeRaio size={13} className="text-petrol-700 shrink-0" />
      <span className="hidden sm:inline">{n(registros)} registros varridos em</span>
      <span className="sm:hidden">{n(registros)} reg. em</span>
      <strong className="font-semibold text-ink-800">{t} ms</strong>
    </span>
  )
}
