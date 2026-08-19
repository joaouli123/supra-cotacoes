// =====================================================================
// Graficos desenhados a mao, em SVG, no servidor.
//
// A alternativa seria uma biblioteca de charts — 60 a 300 KB de JavaScript
// que o navegador baixa, avalia e so entao pinta. Aqui o HTML ja chega
// pintado: a pagina de relatorios abre sem script nenhum, imprime bem e
// funciona igual num desktop do escritorio e num celular de obra.
//
// Todo componente recebe dados prontos e devolve <svg> com viewBox: a
// escala e feita pelo proprio navegador, entao o mesmo grafico serve para
// a coluna estreita e para a tela cheia sem recalcular nada.
// =====================================================================
import type { ReactNode } from 'react'

/** Paleta das series. Ordem fixa: a mesma serie tem a mesma cor em toda tela. */
export const CORES = ['#14544A', '#CA8A04', '#B91C1C', '#525252', '#1A6A5D', '#A3A3A3'] as const

const eixo = '#E5E5E5'
const tinta = '#737373'

/** Caminho suavizado por Catmull-Rom convertido em Bezier cubica. */
function curva(pts: Array<[number, number]>): string {
  if (pts.length === 0) return ''
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

/** Escala "bonita": teto arredondado para 1, 2 ou 5 vezes uma potencia de dez. */
function teto(max: number): number {
  if (max <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(max)))
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) if (max <= m * p) return m * p
  return 10 * p
}

/* ============================================================ area/linha == */

export type PontoSerie = { rotulo: string; valor: number }

/**
 * Serie temporal com area preenchida.
 * `formatar` decide como o eixo Y aparece — moeda, contagem, percentual.
 */
export function GraficoArea({ dados, formatar, cor = CORES[0], altura = 190 }: {
  dados: PontoSerie[]
  formatar: (v: number) => string
  cor?: string
  altura?: number
}) {
  if (dados.length === 0) return <SemDados altura={altura} />

  const L = 8, R = 8, T = 10, B = 26
  const W = 640, H = altura
  const alto = teto(Math.max(...dados.map((d) => d.valor)))
  const larg = W - L - R
  const dispY = H - T - B

  const x = (i: number) => L + (dados.length === 1 ? larg / 2 : (i * larg) / (dados.length - 1))
  const y = (v: number) => T + dispY - (v / alto) * dispY

  const pts = dados.map((d, i) => [x(i), y(d.valor)] as [number, number])
  const linha = curva(pts)
  const area = `${linha} L${x(dados.length - 1)},${T + dispY} L${x(0)},${T + dispY} Z`
  const grade = [0, 0.25, 0.5, 0.75, 1]
  const id = `g${cor.replace('#', '')}`

  // Em series longas so alguns rotulos cabem sem sobrepor.
  const passo = Math.max(1, Math.ceil(dados.length / 7))

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
           aria-label={`Série de ${dados.length} pontos, máximo ${formatar(alto)}`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={cor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {grade.map((g) => (
          <line key={g} x1={L} x2={W - R} y1={T + dispY * g} y2={T + dispY * g}
                stroke={eixo} strokeWidth="1" strokeDasharray={g === 1 ? undefined : '3 4'} />
        ))}

        <path d={area} fill={`url(#${id})`} />
        <path d={linha} fill="none" stroke={cor} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />

        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 3.5 : 2}
                  fill={i === pts.length - 1 ? cor : '#FFFFFF'} stroke={cor} strokeWidth="1.5" />
        ))}

        {dados.map((d, i) => (i % passo === 0 || i === dados.length - 1) && (
          <text key={i} x={x(i)} y={H - 8} fontSize="10" fill={tinta}
                textAnchor={i === 0 ? 'start' : i === dados.length - 1 ? 'end' : 'middle'}>
            {d.rotulo}
          </text>
        ))}
      </svg>

      <div className="flex justify-between text-2xs text-ink-500 tabular px-1">
        <span>0</span><span>{formatar(alto)}</span>
      </div>
    </div>
  )
}

/* ================================================================ colunas = */

/** Colunas verticais — bom para contagens por período. */
export function GraficoColunas({ dados, formatar, cor = CORES[0], altura = 190 }: {
  dados: PontoSerie[]
  formatar: (v: number) => string
  cor?: string
  altura?: number
}) {
  if (dados.length === 0) return <SemDados altura={altura} />

  const W = 640, H = altura, T = 14, B = 28, L = 6, R = 6
  const dispY = H - T - B
  const alto = teto(Math.max(...dados.map((d) => d.valor)))
  const passoX = (W - L - R) / dados.length
  const largura = Math.min(46, passoX * 0.62)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
         aria-label={`${dados.length} colunas, máximo ${formatar(alto)}`}>
      {[0, 0.5, 1].map((g) => (
        <line key={g} x1={L} x2={W - R} y1={T + dispY * g} y2={T + dispY * g}
              stroke={eixo} strokeWidth="1" strokeDasharray={g === 1 ? undefined : '3 4'} />
      ))}

      {dados.map((d, i) => {
        const h = alto > 0 ? (d.valor / alto) * dispY : 0
        const cx = L + passoX * i + passoX / 2
        return (
          <g key={i}>
            <rect x={cx - largura / 2} y={T + dispY - h} width={largura} height={Math.max(h, d.valor > 0 ? 2 : 0)}
                  rx="2" fill={cor} opacity={i === dados.length - 1 ? 1 : 0.72} />
            {d.valor > 0 && (
              <text x={cx} y={T + dispY - h - 4} fontSize="10" fill={tinta} textAnchor="middle" className="tabular">
                {formatar(d.valor)}
              </text>
            )}
            <text x={cx} y={H - 9} fontSize="10" fill={tinta} textAnchor="middle">{d.rotulo}</text>
          </g>
        )
      })}
    </svg>
  )
}

/* ========================================================= barras (rank) == */

/** Ranking horizontal: o rotulo tem espaço para ser lido por inteiro. */
export function GraficoBarras({ dados, formatar, cor = CORES[0] }: {
  dados: Array<PontoSerie & { apoio?: string }>
  formatar: (v: number) => string
  cor?: string
}) {
  if (dados.length === 0) return <SemDados altura={120} />
  const alto = Math.max(...dados.map((d) => d.valor)) || 1

  return (
    <ul className="space-y-2.5">
      {dados.map((d, i) => (
        <li key={i}>
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <span className="text-xs text-ink-700 truncate">{d.rotulo}</span>
            <span className="text-xs text-ink-900 tabular font-medium whitespace-nowrap">{formatar(d.valor)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
            <div className="h-full rounded-full" style={{
              width: `${Math.max(2, (d.valor / alto) * 100)}%`,
              backgroundColor: cor,
              opacity: 1 - i * 0.09,
            }} />
          </div>
          {d.apoio && <p className="text-2xs text-ink-500 mt-0.5">{d.apoio}</p>}
        </li>
      ))}
    </ul>
  )
}

/* ================================================================= rosca == */

export type Fatia = { rotulo: string; valor: number; cor?: string }

/** Rosca com legenda. Para composição — status, canal, curva ABC. */
export function GraficoRosca({ fatias, total, centro, apoio }: {
  fatias: Fatia[]
  /** Total explícito quando as fatias não somam o universo. */
  total?: number
  centro: string
  apoio?: string
}) {
  const soma = total ?? fatias.reduce((t, f) => t + f.valor, 0)
  if (soma <= 0) return <SemDados altura={150} />

  const R = 54, r = 36, cx = 60, cy = 60
  let ang = -Math.PI / 2

  const arcos = fatias.filter((f) => f.valor > 0).map((f, i) => {
    const passo = (f.valor / soma) * Math.PI * 2
    const a0 = ang
    const a1 = ang + passo
    ang = a1
    const grande = passo > Math.PI ? 1 : 0
    // Circulo completo nao se desenha com um arco so: vira dois semicirculos.
    const d = passo >= Math.PI * 2 - 1e-6
      ? `M${cx - R},${cy} A${R},${R} 0 1 1 ${cx + R},${cy} A${R},${R} 0 1 1 ${cx - R},${cy}
         M${cx - r},${cy} A${r},${r} 0 1 0 ${cx + r},${cy} A${r},${r} 0 1 0 ${cx - r},${cy}`
      : `M${(cx + R * Math.cos(a0)).toFixed(2)},${(cy + R * Math.sin(a0)).toFixed(2)}
         A${R},${R} 0 ${grande} 1 ${(cx + R * Math.cos(a1)).toFixed(2)},${(cy + R * Math.sin(a1)).toFixed(2)}
         L${(cx + r * Math.cos(a1)).toFixed(2)},${(cy + r * Math.sin(a1)).toFixed(2)}
         A${r},${r} 0 ${grande} 0 ${(cx + r * Math.cos(a0)).toFixed(2)},${(cy + r * Math.sin(a0)).toFixed(2)} Z`
    return { d, cor: f.cor ?? CORES[i % CORES.length], f }
  })

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg viewBox="0 0 120 120" className="w-[120px] h-[120px] shrink-0" role="img"
           aria-label={`Composição em ${arcos.length} partes`}>
        <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none" stroke={eixo} strokeWidth={R - r} />
        {arcos.map((a, i) => <path key={i} d={a.d} fill={a.cor} fillRule="evenodd" />)}
        <text x={cx} y={cy - 1} fontSize="17" fontWeight="600" fill="#171717"
              textAnchor="middle" className="tabular">{centro}</text>
        {apoio && <text x={cx} y={cy + 13} fontSize="9" fill={tinta} textAnchor="middle">{apoio}</text>}
      </svg>

      <ul className="flex-1 min-w-[150px] space-y-1.5">
        {arcos.map((a, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: a.cor }} />
            <span className="text-ink-700 flex-1 truncate">{a.f.rotulo}</span>
            <span className="text-ink-900 tabular font-medium">{a.f.valor}</span>
            <span className="text-ink-400 tabular w-10 text-right">
              {Math.round((a.f.valor / soma) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ============================================================== ausencia == */

function SemDados({ altura }: { altura: number }) {
  return (
    <div className="flex items-center justify-center text-xs text-ink-400 border border-dashed
                    border-ink-200 rounded-lg" style={{ height: altura }}>
      Sem dados no período selecionado
    </div>
  )
}

/** Legenda avulsa, para gráficos que dividem eixo com outra série. */
export function Legenda({ itens }: { itens: Array<{ rotulo: string; cor: string; nota?: ReactNode }> }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {itens.map((i) => (
        <li key={i.rotulo} className="flex items-center gap-1.5 text-2xs text-ink-600">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: i.cor }} />
          {i.rotulo}{i.nota && <span className="text-ink-400">· {i.nota}</span>}
        </li>
      ))}
    </ul>
  )
}
