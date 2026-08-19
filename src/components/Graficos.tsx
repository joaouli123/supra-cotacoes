// =====================================================================
// Graficos desenhados a mao, em SVG, no servidor.
//
// A alternativa seria uma biblioteca de charts — 60 a 300 KB de JavaScript
// que o navegador baixa, avalia e so entao pinta. Aqui o HTML ja chega
// pintado: a pagina de relatorios abre sem script nenhum, imprime bem e
// funciona igual num desktop do escritorio e num celular de obra.
//
// Todo componente recebe dados prontos e uma altura em pixels. So a largura
// acompanha o container: um grafico de 180 px continua com 180 px de altura
// tanto na coluna estreita quanto no painel que ocupa a tela inteira.
// =====================================================================
import type { ReactNode } from 'react'

/** Paleta das series. Ordem fixa: a mesma serie tem a mesma cor em toda tela. */
export const CORES = ['#14544A', '#CA8A04', '#B91C1C', '#525252', '#1A6A5D', '#A3A3A3'] as const

const eixo = '#E5E5E5'
const tinta = '#737373'

/**
 * Caminho suavizado por spline cubica monotona (Fritsch-Carlson).
 *
 * Catmull-Rom, que estava aqui antes, projeta a tangente de um ponto usando os
 * vizinhos, e por isso ultrapassa o valor mais alto da serie entre dois pontos:
 * o desenho subia acima do teto da escala e o SVG aparava a lombada no topo.
 * A versao monotona limita a tangente ao que os dois extremos do trecho
 * permitem — a curva continua macia, mas nunca passa do ponto mais alto nem
 * mergulha abaixo do mais baixo.
 */
function curva(pts: Array<[number, number]>): string {
  if (pts.length === 0) return ''
  if (pts.length < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')

  const n = pts.length
  const h: number[] = []   // largura de cada trecho
  const s: number[] = []   // inclinacao de cada trecho
  for (let i = 0; i < n - 1; i++) {
    h[i] = pts[i + 1][0] - pts[i][0]
    s[i] = h[i] === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / h[i]
  }

  // Tangente inicial de cada ponto: media das inclinacoes vizinhas.
  const m: number[] = [s[0]]
  for (let i = 1; i < n - 1; i++) m[i] = (s[i - 1] + s[i]) / 2
  m[n - 1] = s[n - 2]

  for (let i = 0; i < n - 1; i++) {
    // Trecho plano trava as duas pontas: sem isso a curva inventa uma barriga
    // onde os dois valores sao iguais.
    if (s[i] === 0) { m[i] = 0; m[i + 1] = 0; continue }
    const a = m[i] / s[i]
    const b = m[i + 1] / s[i]
    const q = Math.hypot(a, b)
    if (q > 3) {
      const t = 3 / q
      m[i] = t * a * s[i]
      m[i + 1] = t * b * s[i]
    }
  }

  const f = (v: number) => v.toFixed(2)
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i][0] + h[i] / 3
    const c1y = pts[i][1] + (m[i] * h[i]) / 3
    const c2x = pts[i + 1][0] - h[i] / 3
    const c2y = pts[i + 1][1] - (m[i + 1] * h[i]) / 3
    d += ` C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(pts[i + 1][0])},${f(pts[i + 1][1])}`
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

/* ============================================================== escala == */
//
// A altura de um grafico e dada em pixels e respeitada ao pe da letra. Parece
// obvio, mas era justamente o que faltava: um <svg viewBox> com "h-auto"
// preserva a *proporcao*, nao a altura — o mesmo desenho de 640x210 que ficava
// certo numa coluna de 640 px esticava para 490 px de altura no painel largo,
// e a fonte 10 do rotulo era ampliada 2,3 vezes junto.
//
// Aqui a largura e a unica coisa que acompanha o container. Grade, eixos e
// rotulos sao HTML posicionado em pixel; so a mancha da serie e SVG, esticada
// de proposito no eixo X com preserveAspectRatio="none".

/** Frações do teto que ganham linha de grade e rótulo no eixo Y. */
const NIVEIS = [1, 0.5, 0] as const

/** Rótulos do eixo Y, cada um centrado na sua linha de grade. */
function EixoY({ alto, formatar, topo, zona, largura }: {
  alto: number
  formatar: (v: number) => string
  topo: number
  zona: number
  largura: number
}) {
  return (
    <div className="relative shrink-0" style={{ width: largura }}>
      {NIVEIS.map((n) => (
        <span key={n} style={{ top: topo + zona * (1 - n) }}
              className="absolute right-0 -translate-y-1/2 text-2xs text-ink-400 tabular whitespace-nowrap">
          {formatar(alto * n)}
        </span>
      ))}
    </div>
  )
}

function Grade({ topo, zona }: { topo: number; zona: number }) {
  return (
    <>
      {NIVEIS.map((n) => (
        <div key={n} aria-hidden style={{ top: topo + zona * (1 - n) }}
             className={`absolute inset-x-0 border-t ${n === 0 ? 'border-ink-200' : 'border-dashed border-ink-200'}`} />
      ))}
    </>
  )
}

/** Rótulos do eixo X, ancorados na mesma fração de largura usada no desenho. */
function EixoX({ dados, posicao, recuo, centrado = false }: {
  dados: PontoSerie[]
  posicao: (i: number) => number
  recuo: number
  /** Colunas: o rótulo fica centrado na barra, inclusive nas pontas. Numa
   *  série de linha o primeiro e o último ponto encostam na borda, e ali o
   *  rótulo tem de encostar junto para não vazar do painel. */
  centrado?: boolean
}) {
  // Em série longa só alguns rótulos cabem sem encavalar.
  const passo = Math.max(1, Math.ceil(dados.length / 8))
  const ponta = (i: number) =>
    centrado || (i > 0 && i < dados.length - 1) ? '-50%' : i === 0 ? '0%' : '-100%'

  return (
    <div className="flex gap-2 mt-2">
      <div className="shrink-0" style={{ width: recuo }} />
      <div className="relative flex-1 min-w-0 h-4">
        {dados.map((d, i) => (i % passo === 0 || i === dados.length - 1) && (
          <span key={i} style={{ left: `${posicao(i)}%`, transform: `translateX(${ponta(i)})` }}
                className="absolute top-0 text-2xs text-ink-500 whitespace-nowrap">
            {d.rotulo}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ============================================================ area/linha == */

export type PontoSerie = { rotulo: string; valor: number }

/**
 * Série temporal com área preenchida.
 * `formatar` decide como o eixo Y aparece — moeda, contagem, percentual.
 */
export function GraficoArea({ dados, formatar, cor = CORES[0], altura = 180 }: {
  dados: PontoSerie[]
  formatar: (v: number) => string
  cor?: string
  altura?: number
}) {
  if (dados.length === 0) return <SemDados altura={altura} />

  const TOPO = 10, RECUO = 62
  const zona = altura - TOPO
  const alto = teto(Math.max(...dados.map((d) => d.valor)))

  // Percentual: serve tanto para o SVG esticado quanto para o CSS dos pontos.
  const px = (i: number) => (dados.length === 1 ? 50 : (i * 100) / (dados.length - 1))
  const py = (v: number) => 100 - (v / alto) * 100

  const pts = dados.map((d, i) => [px(i), py(d.valor)] as [number, number])
  const linha = curva(pts)
  const area = `${linha} L${px(dados.length - 1)},100 L${px(0)},100 Z`
  const id = `g${cor.replace('#', '')}`

  return (
    <div>
      <div className="flex gap-2" style={{ height: altura }}>
        <EixoY alto={alto} formatar={formatar} topo={TOPO} zona={zona} largura={RECUO} />

        <div className="relative flex-1 min-w-0">
          <Grade topo={TOPO} zona={zona} />

          {/* O eixo X estica com a coluna; a espessura do traço, não —
              por isso o vectorEffect. */}
          <svg style={{ top: TOPO, height: zona }} className="absolute inset-x-0 w-full overflow-visible" role="img"
               viewBox="0 0 100 100" preserveAspectRatio="none"
               aria-label={`Série de ${dados.length} pontos, máximo ${formatar(alto)}`}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={cor} stopOpacity="0.16" />
                <stop offset="100%" stopColor={cor} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${id})`} />
            <path d={linha} fill="none" stroke={cor} strokeWidth="2" vectorEffect="non-scaling-stroke"
                  strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* Ponto em HTML: dentro do SVG esticado ele viraria elipse. */}
          {dados.map((d, i) => {
            const fim = i === dados.length - 1
            return (
              <span key={i} aria-hidden
                    style={{
                      left: `${px(i)}%`,
                      top: TOPO + zona * (py(d.valor) / 100),
                      width: fim ? 9 : 6,
                      height: fim ? 9 : 6,
                      backgroundColor: fim ? cor : '#FFFFFF',
                      boxShadow: `0 0 0 1.5px ${cor}`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full" />
            )
          })}
        </div>
      </div>

      <EixoX dados={dados} posicao={px} recuo={RECUO} />
    </div>
  )
}

/* ================================================================ colunas = */

/** Colunas verticais — bom para contagens por período. */
export function GraficoColunas({ dados, formatar, cor = CORES[0], altura = 180 }: {
  dados: PontoSerie[]
  formatar: (v: number) => string
  cor?: string
  altura?: number
}) {
  if (dados.length === 0) return <SemDados altura={altura} />

  // A faixa do topo é reservada para o valor escrito acima da coluna mais
  // alta; sem ela, a coluna que encosta no teto empurra o número para fora.
  const TOPO = 20, RECUO = 34
  const zona = altura - TOPO
  const alto = teto(Math.max(...dados.map((d) => d.valor)))

  return (
    <div>
      <div className="flex gap-2" style={{ height: altura }}>
        <EixoY alto={alto} formatar={formatar} topo={TOPO} zona={zona} largura={RECUO} />

        <div className="relative flex-1 min-w-0">
          <Grade topo={TOPO} zona={zona} />

          <div className="absolute inset-0 flex items-stretch">
            {dados.map((d, i) => {
              const h = alto > 0 ? (d.valor / alto) * zona : 0
              return (
                <div key={i} className="relative flex-1">
                  <div style={{ height: Math.max(h, d.valor > 0 ? 2 : 0), backgroundColor: cor,
                                opacity: i === dados.length - 1 ? 1 : 0.72 }}
                       className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[58%] max-w-[52px] rounded-t-[3px]" />
                  {d.valor > 0 && (
                    <span style={{ bottom: h + 3 }}
                          className="absolute inset-x-0 text-center text-2xs text-ink-600 tabular">
                      {formatar(d.valor)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <EixoX dados={dados} posicao={(i) => ((i + 0.5) * 100) / dados.length} recuo={RECUO} centrado />
    </div>
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
