const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const NUM = new Intl.NumberFormat('pt-BR')
const NUM2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const PCT = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const moeda = (v: number) => BRL.format(v)
export const moedaCurta = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$ ${NUM2.format(v / 1_000_000)} mi`
  if (Math.abs(v) >= 10_000) return BRL0.format(v)
  return BRL.format(v)
}
export const numero = (v: number) => NUM.format(v)
export const numero2 = (v: number) => NUM2.format(v)
export const percentual = (v: number) => PCT.format(v)

export function dataHora(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
export function data(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
export function dataRelativa(iso: string | null | undefined) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.round(diff / 3600000)
  if (h < 1) return 'há poucos minutos'
  if (h < 24) return `há ${h}h`
  const d = Math.round(h / 24)
  if (d < 30) return `há ${d}d`
  const m = Math.round(d / 30)
  return m < 12 ? `há ${m} ${m === 1 ? 'mês' : 'meses'}` : `há ${Math.round(m / 12)}a`
}
export const iniciais = (nome: string) =>
  nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

/** Decimal em pt-BR (vírgula como separador). Evita "1.39%" no lugar de "1,39%". */
export const dec = (v: number, casas = 2) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v)
