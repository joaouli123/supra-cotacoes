/** Condicoes de pagamento aceitas, com o prazo medio em dias usado na equalizacao. */
export const COND_PAGAMENTO: Array<[string, number]> = [
  ['À vista', 0], ['7 dias', 7], ['14 dias', 14], ['21 dias', 21], ['28 dias', 28],
  ['30 dias', 30], ['30/60 dias', 45], ['30/60/90 dias', 60], ['45 dias', 45],
  ['60 dias', 60], ['Faturado 30 dias', 30], ['Boleto 15 dias', 15],
]
export const PRAZO_DE = (rotulo: string) =>
  COND_PAGAMENTO.find(([r]) => r === rotulo)?.[1] ?? 30
