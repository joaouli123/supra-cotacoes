import Link from 'next/link'
import type { ReactNode } from 'react'
import { moeda, numero, percentual } from '@/lib/formato'
import {
  IconeChevronDir, IconeChevronEsq, IconeVazio, IconeTendencia, IconeQueda,
} from './icones'

/* ================================================================ Painel */
export function Painel({ titulo, icone, acao, children, className = '', semPadding = false }: {
  titulo?: ReactNode; icone?: ReactNode; acao?: ReactNode
  children: ReactNode; className?: string; semPadding?: boolean
}) {
  return (
    <section className={`painel ${className}`}>
      {titulo && (
        <header className="painel-titulo">
          <h2 className="text-sm font-semibold text-ink-900 flex items-center gap-2 min-w-0">
            {icone && <span className="text-ink-400 shrink-0">{icone}</span>}
            <span className="truncate">{titulo}</span>
          </h2>
          {acao && <div className="flex items-center gap-2 shrink-0">{acao}</div>}
        </header>
      )}
      <div className={semPadding ? '' : 'painel-corpo'}>{children}</div>
    </section>
  )
}

/* =================================================================== Tag */
type Variante = 'neutra' | 'ativa' | 'positiva' | 'atencao' | 'critica'
export function Tag({ children, variante = 'neutra', ponto = false, icone }: {
  children: ReactNode; variante?: Variante; ponto?: boolean; icone?: ReactNode
}) {
  const cores: Record<Variante, string> = {
    neutra: 'bg-ink-400', ativa: 'bg-petrol-700', positiva: 'bg-positive-600',
    atencao: 'bg-caution-600', critica: 'bg-critical-600',
  }
  return (
    <span className={`tag tag-${variante}`}>
      {ponto && <i className={`ponto ${cores[variante]}`} />}
      {icone}
      {children}
    </span>
  )
}

const MAPA_STATUS: Record<string, { rotulo: string; v: Variante }> = {
  rascunho:      { rotulo: 'Rascunho', v: 'neutra' },
  programada:    { rotulo: 'Programada', v: 'ativa' },
  em_andamento:  { rotulo: 'Em andamento', v: 'atencao' },
  encerrada:     { rotulo: 'Encerrada', v: 'neutra' },
  equalizada:    { rotulo: 'Equalizada', v: 'positiva' },
  cancelada:     { rotulo: 'Cancelada', v: 'critica' },
  convidado:     { rotulo: 'Convidado', v: 'neutra' },
  visualizado:   { rotulo: 'Visualizado', v: 'ativa' },
  respondido:    { rotulo: 'Respondido', v: 'positiva' },
  recusado:      { rotulo: 'Recusado', v: 'critica' },
  expirado:      { rotulo: 'Expirado', v: 'neutra' },
  aberta:        { rotulo: 'Aberta', v: 'ativa' },
  em_cotacao:    { rotulo: 'Em cotação', v: 'atencao' },
  atendida:      { rotulo: 'Atendida', v: 'positiva' },
  ativo:         { rotulo: 'Ativo', v: 'positiva' },
  homologacao:   { rotulo: 'Homologação', v: 'atencao' },
  inativo:       { rotulo: 'Inativo', v: 'neutra' },
  erro:          { rotulo: 'Erro', v: 'critica' },
  sucesso:       { rotulo: 'Sucesso', v: 'positiva' },
  pendente:      { rotulo: 'Pendente', v: 'atencao' },
  reprocessando: { rotulo: 'Reprocessando', v: 'atencao' },
}
export function StatusTag({ status }: { status: string }) {
  const s = MAPA_STATUS[status] ?? { rotulo: status, v: 'neutra' as Variante }
  return <Tag variante={s.v} ponto>{s.rotulo}</Tag>
}

/* =================================================================== KPI */
export function Kpi({ rotulo, valor, apoio, tom = 'neutro', icone }: {
  rotulo: string; valor: ReactNode; apoio?: ReactNode
  tom?: 'neutro' | 'positivo' | 'atencao'; icone?: ReactNode
}) {
  const cor = tom === 'positivo' ? 'text-positive-700' : tom === 'atencao' ? 'text-caution-700' : 'text-ink-900'
  return (
    <div className="px-4 sm:px-5 py-4">
      <div className="flex items-center gap-2">
        {icone && <span className="text-ink-400 shrink-0">{icone}</span>}
        <p className="kpi-rotulo">{rotulo}</p>
      </div>
      <p className={`kpi-valor mt-1.5 ${cor}`}>{valor}</p>
      {apoio && <p className="text-xs text-ink-500 mt-1 leading-snug">{apoio}</p>}
    </div>
  )
}

export function GradeKpis({ children }: { children: ReactNode }) {
  return (
    <div className="painel grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4
                    divide-y sm:divide-y-0 divide-ink-200
                    sm:[&>*:nth-child(2n)]:border-l xl:[&>*:nth-child(2n)]:border-l-0
                    xl:[&>*+*]:border-l sm:[&>*:nth-child(n+3)]:border-t xl:[&>*:nth-child(n+3)]:border-t-0
                    [&>*]:border-ink-200">
      {children}
    </div>
  )
}

/* ================================================================= Barra */
export function Barra({ valor, cor = 'bg-ink-900' }: { valor: number; cor?: string }) {
  return (
    <div className="barra" role="presentation">
      <span className={cor} style={{ width: `${Math.min(100, Math.max(0, valor * 100))}%` }} />
    </div>
  )
}

/* ================================================================= Vazio */
export function Vazio({ titulo, descricao, icone, acao }: {
  titulo: string; descricao?: string; icone?: ReactNode; acao?: ReactNode
}) {
  return (
    <div className="py-14 px-6 text-center">
      <span className="icone-circulo w-11 h-11 mx-auto mb-3.5">
        {icone ?? <IconeVazio size={20} />}
      </span>
      <p className="text-sm font-medium text-ink-800">{titulo}</p>
      {descricao && <p className="text-sm text-ink-500 mt-1.5 max-w-sm mx-auto leading-relaxed">{descricao}</p>}
      {acao && <div className="mt-4 flex justify-center">{acao}</div>}
    </div>
  )
}

/* ============================================================ Paginacao */
function janelaDePaginas(atual: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const p = new Set<number>([1, total, atual, atual - 1, atual + 1])
  if (atual <= 3) [2, 3, 4].forEach((n) => p.add(n))
  if (atual >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => p.add(n))
  const ord = [...p].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const saida: Array<number | '…'> = []
  ord.forEach((n, i) => {
    if (i > 0 && n - (ord[i - 1] as number) > 1) saida.push('…')
    saida.push(n)
  })
  return saida
}

export function Paginacao({ base, pagina, porPagina, total }: {
  base: string; pagina: number; porPagina: number; total: number
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const de = total === 0 ? 0 : (pagina - 1) * porPagina + 1
  const ate = Math.min(total, pagina * porPagina)
  const url = (p: number) => `${base}${base.includes('?') ? '&' : '?'}pagina=${p}`

  return (
    <nav aria-label="Paginação"
         className="flex flex-col sm:flex-row items-center justify-between gap-3
                    px-4 sm:px-5 py-3 border-t border-ink-200">
      <p className="text-xs text-ink-500 order-2 sm:order-1">
        <span className="tabular font-medium text-ink-800">{numero(de)}–{numero(ate)}</span>
        {' de '}
        <span className="tabular font-medium text-ink-800">{numero(total)}</span>
        {total === 1 ? ' registro' : ' registros'}
      </p>

      {paginas > 1 && (
        <div className="flex items-center gap-1 order-1 sm:order-2">
          {pagina > 1 ? (
            <Link href={url(pagina - 1)} aria-label="Página anterior" className="btn btn-secundario btn-sm btn-icone">
              <IconeChevronEsq size={15} />
            </Link>
          ) : (
            <span className="btn btn-secundario btn-sm btn-icone opacity-40 pointer-events-none">
              <IconeChevronEsq size={15} />
            </span>
          )}

          {/* numeros de pagina: telas medias em diante */}
          <div className="hidden sm:flex items-center gap-1">
            {janelaDePaginas(pagina, paginas).map((p, i) =>
              p === '…' ? (
                <span key={`e${i}`} className="w-7 text-center text-xs text-ink-400">…</span>
              ) : (
                <Link key={p} href={url(p)} aria-current={p === pagina ? 'page' : undefined}
                      className={`btn btn-sm btn-icone tabular ${
                        p === pagina ? 'btn-primario' : 'btn-secundario'}`}>
                  {p}
                </Link>
              ))}
          </div>

          {/* celular: apenas posicao */}
          <span className="sm:hidden text-xs text-ink-600 tabular px-2">
            {numero(pagina)} / {numero(paginas)}
          </span>

          {pagina < paginas ? (
            <Link href={url(pagina + 1)} aria-label="Próxima página" className="btn btn-secundario btn-sm btn-icone">
              <IconeChevronDir size={15} />
            </Link>
          ) : (
            <span className="btn btn-secundario btn-sm btn-icone opacity-40 pointer-events-none">
              <IconeChevronDir size={15} />
            </span>
          )}
        </div>
      )}
    </nav>
  )
}

/* ====================================================== Cabecalho pagina */
export function CabecalhoPagina({ titulo, descricao, acoes, migalhas, icone }: {
  titulo: string; descricao?: string; acoes?: ReactNode; icone?: ReactNode
  migalhas?: Array<{ rotulo: string; href?: string }>
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 mb-5 sm:mb-6">
      <div className="min-w-0 flex gap-3.5">
        {icone && <span className="icone-circulo w-10 h-10 mt-0.5 hidden sm:grid">{icone}</span>}
        <div className="min-w-0">
          {migalhas && (
            <nav aria-label="Trilha" className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-500 mb-1.5">
              {migalhas.map((m, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-ink-300" aria-hidden>/</span>}
                  {m.href
                    ? <Link href={m.href} className="hover:text-ink-900 transition-colors">{m.rotulo}</Link>
                    : <span className="text-ink-700">{m.rotulo}</span>}
                </span>
              ))}
            </nav>
          )}
          <h1 className="text-lg sm:text-xl font-semibold text-ink-900 tracking-tight leading-tight">{titulo}</h1>
          {descricao && <p className="text-sm text-ink-500 mt-1.5 max-w-2xl leading-relaxed">{descricao}</p>}
        </div>
      </div>
      {acoes && <div className="flex items-center gap-2 flex-wrap shrink-0">{acoes}</div>}
    </div>
  )
}

/* ============================================================ Rotulo/valor */
export function Campo({ rotulo, children, icone }: { rotulo: string; children: ReactNode; icone?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-ink-100 last:border-b-0">
      <dt className="text-xs text-ink-500 shrink-0 flex items-center gap-1.5">
        {icone && <span className="text-ink-400">{icone}</span>}{rotulo}
      </dt>
      <dd className="text-sm text-ink-900 text-right min-w-0 break-words">{children}</dd>
    </div>
  )
}

/* ============================================================== Dinheiro */
export function Dinheiro({ v, forte = false, tom }: { v: number; forte?: boolean; tom?: 'positivo' | 'critico' }) {
  const cor = tom === 'positivo' ? 'text-positive-700' : tom === 'critico' ? 'text-critical-700' : ''
  return <span className={`tabular ${forte ? 'font-semibold' : ''} ${cor}`}>{moeda(v)}</span>
}

export function Delta({ v }: { v: number }) {
  if (Math.abs(v) < 0.00005) return <span className="text-xs text-ink-400">—</span>
  const alta = v > 0
  return (
    <span className={`text-xs tabular font-medium inline-flex items-center gap-1 justify-end
                      ${alta ? 'text-critical-700' : 'text-positive-700'}`}>
      {alta ? <IconeTendencia size={12} /> : <IconeQueda size={12} />}
      {alta ? '+' : ''}{percentual(v)}
    </span>
  )
}

/* ========================================================= Bloco de aviso */
export function Aviso({ tom = 'neutro', icone, titulo, children }: {
  tom?: 'neutro' | 'positivo' | 'atencao' | 'critico'; icone?: ReactNode
  titulo?: string; children: ReactNode
}) {
  const estilos = {
    neutro:   'border-ink-200 bg-white text-ink-600',
    positivo: 'border-positive-600/30 bg-positive-100/40 text-ink-700',
    atencao:  'border-caution-600/30 bg-caution-100/40 text-ink-700',
    critico:  'border-critical-600/30 bg-critical-100/40 text-ink-700',
  }
  const corIcone = {
    neutro: 'text-ink-400', positivo: 'text-positive-700',
    atencao: 'text-caution-700', critico: 'text-critical-700',
  }
  return (
    <div className={`border rounded-lg px-4 sm:px-5 py-3.5 flex gap-3 ${estilos[tom]}`}>
      {icone && <span className={`shrink-0 mt-0.5 ${corIcone[tom]}`}>{icone}</span>}
      <div className="min-w-0 text-sm leading-relaxed">
        {titulo && <p className="font-medium text-ink-900 mb-1">{titulo}</p>}
        {children}
      </div>
    </div>
  )
}
