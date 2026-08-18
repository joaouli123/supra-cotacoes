// =====================================================================
// Motor de equalizacao de propostas.
//
// Regra de negocio (levantamento do cliente):
//  - considerar TODAS as variaveis: preco unitario, frete, impostos,
//    prazo de entrega e condicao de pagamento;
//  - apurar o MENOR PRECO GLOBAL POR FORNECEDOR e o MENOR PRECO POR ITEM;
//  - decisao automatica, com a memoria de calculo integralmente exposta.
//
// Sequencia de calculo, por item de cada proposta:
//   1. bruto        = preco_unitario x quantidade
//   2. liquido      = bruto - desconto comercial da proposta
//   3. impostos     = IPI + ICMS-ST incidentes sobre o liquido
//   4. frete        = rateado por participacao no valor (somente FOB;
//                     CIF ja embute o frete no preco)
//   5. custo posto  = liquido + impostos + frete
//   6. valor presente = custo posto descontado pelo prazo de pagamento,
//                     a taxa de capital da empresa (dinheiro no tempo)
//   7. custo final  = valor presente + penalidade por prazo de entrega
// =====================================================================

export type OfertaItem = {
  fornecedorId: number
  fornecedor: string
  disponivel: boolean
  precoUnitario: number
  marca: string | null
  ipiPct: number
  icmsStPct: number
  bruto: number
  desconto: number
  liquido: number
  impostos: number
  frete: number
  custoPosto: number
  valorPresente: number
  penalidadePrazo: number
  custoFinal: number
  unitarioFinal: number
  vencedor: boolean
  deltaVsMelhor: number
}

export type ItemEqualizado = {
  cotacaoItemId: number
  materialId: number
  codigo: string
  descricao: string
  unidade: string
  quantidade: number
  precoReferencia: number
  referenciaTotal: number
  ofertas: OfertaItem[]
  vencedor: OfertaItem | null
  dispersao: number // (maior - menor) / menor
}

export type ResumoFornecedor = {
  fornecedorId: number
  fornecedor: string
  cnpj: string
  cidade: string
  uf: string
  avaliacao: number
  freteTipo: 'CIF' | 'FOB'
  valorFrete: number
  prazoEntregaDias: number
  condPagamento: string
  prazoPagamentoDias: number
  descontoPct: number
  validadeDias: number
  observacoes: string | null
  enviadaEm: string
  itensCotados: number
  itensTotais: number
  cobertura: number
  completa: boolean
  totalBruto: number
  totalDesconto: number
  totalImpostos: number
  totalFrete: number
  totalCustoPosto: number
  totalFinal: number
  posicao: number | null
  vencedorGlobal: boolean
  itensVencidos: number
  deltaVsMelhor: number
}

export type Equalizacao = {
  itens: ItemEqualizado[]
  fornecedores: ResumoFornecedor[]
  totalReferencia: number
  melhorGlobal: ResumoFornecedor | null
  totalMelhorGlobal: number
  totalMelhorPorItem: number
  totalMediaPropostas: number
  totalMaiorProposta: number
  economiaVsMedia: number
  economiaVsMaior: number
  fornecedoresNaPulverizacao: number
  economiaGlobalVsReferencia: number
  economiaPorItemVsReferencia: number
  ganhoPulverizacao: number
  itensSemOferta: number
  parametros: { taxaCapitalMes: number; pesoPrazoDia: number }
}

// ---- entradas cruas vindas do banco -------------------------------
export type ItemCru = {
  id: number
  material_id: number
  codigo: string
  descricao: string
  unidade: string
  quantidade: number
  preco_referencia: number
}
export type PropostaCrua = {
  id: number
  fornecedor_id: number
  fornecedor: string
  cnpj: string
  cidade: string
  uf: string
  avaliacao: number
  frete_tipo: 'CIF' | 'FOB'
  valor_frete: number
  prazo_entrega_dias: number
  cond_pagamento: string
  prazo_pagamento_dias: number
  desconto_pct: number
  validade_dias: number
  observacoes: string | null
  enviada_em: string
}
export type PropostaItemCru = {
  proposta_id: number
  cotacao_item_id: number
  preco_unitario: number
  ipi_pct: number
  icms_st_pct: number
  marca: string | null
  disponivel: number
}

const cent = (v: number) => Math.round(v * 100) / 100

export function equalizar(
  itens: ItemCru[],
  propostas: PropostaCrua[],
  propostaItens: PropostaItemCru[],
  parametros: { taxaCapitalMes: number; pesoPrazoDia: number },
): Equalizacao {
  const { taxaCapitalMes, pesoPrazoDia } = parametros
  const porProposta = new Map<number, PropostaItemCru[]>()
  for (const pi of propostaItens) {
    const arr = porProposta.get(pi.proposta_id)
    if (arr) arr.push(pi)
    else porProposta.set(pi.proposta_id, [pi])
  }

  // ---------- 1. custo por item, para cada proposta ----------
  // chave: `${propostaId}:${cotacaoItemId}`
  const custos = new Map<string, OfertaItem>()
  const resumos: ResumoFornecedor[] = []
  const itemPorId = new Map(itens.map((i) => [i.id, i]))

  for (const p of propostas) {
    const linhas = (porProposta.get(p.id) ?? []).filter((l) => l.disponivel === 1)
    if (!linhas.length) continue

    // etapas 1-3: mercadoria com desconto e impostos
    const parciais = linhas.map((l) => {
      const item = itemPorId.get(l.cotacao_item_id)
      const qtd = item?.quantidade ?? 0
      const bruto = l.preco_unitario * qtd
      const desconto = bruto * (p.desconto_pct / 100)
      const liquido = bruto - desconto
      const impostos = liquido * (l.ipi_pct / 100) + liquido * (l.icms_st_pct / 100)
      return { l, item, qtd, bruto, desconto, liquido, impostos, mercadoria: liquido + impostos }
    })

    const baseRateio = parciais.reduce((s, x) => s + x.mercadoria, 0)
    // etapa 4: frete FOB rateado por participacao no valor da mercadoria
    const freteTotal = p.frete_tipo === 'FOB' ? p.valor_frete : 0

    let totalBruto = 0, totalDesconto = 0, totalImpostos = 0, totalFrete = 0
    let totalCustoPosto = 0, totalFinal = 0

    for (const x of parciais) {
      const frete = baseRateio > 0 ? freteTotal * (x.mercadoria / baseRateio) : 0
      const custoPosto = x.mercadoria + frete
      // etapa 6: dinheiro no tempo — pagar depois vale menos hoje
      const valorPresente = custoPosto / Math.pow(1 + taxaCapitalMes / 100, p.prazo_pagamento_dias / 30)
      // etapa 7: penalidade por prazo de entrega
      const penalidadePrazo = valorPresente * (pesoPrazoDia / 100) * p.prazo_entrega_dias
      const custoFinal = valorPresente + penalidadePrazo

      custos.set(`${p.id}:${x.l.cotacao_item_id}`, {
        fornecedorId: p.fornecedor_id,
        fornecedor: p.fornecedor,
        disponivel: true,
        precoUnitario: x.l.preco_unitario,
        marca: x.l.marca,
        ipiPct: x.l.ipi_pct,
        icmsStPct: x.l.icms_st_pct,
        bruto: cent(x.bruto),
        desconto: cent(x.desconto),
        liquido: cent(x.liquido),
        impostos: cent(x.impostos),
        frete: cent(frete),
        custoPosto: cent(custoPosto),
        valorPresente: cent(valorPresente),
        penalidadePrazo: cent(penalidadePrazo),
        custoFinal: cent(custoFinal),
        unitarioFinal: x.qtd > 0 ? custoFinal / x.qtd : 0,
        vencedor: false,
        deltaVsMelhor: 0,
      })

      totalBruto += x.bruto; totalDesconto += x.desconto; totalImpostos += x.impostos
      totalFrete += frete; totalCustoPosto += custoPosto; totalFinal += custoFinal
    }

    resumos.push({
      fornecedorId: p.fornecedor_id,
      fornecedor: p.fornecedor,
      cnpj: p.cnpj,
      cidade: p.cidade,
      uf: p.uf,
      avaliacao: p.avaliacao,
      freteTipo: p.frete_tipo,
      valorFrete: p.valor_frete,
      prazoEntregaDias: p.prazo_entrega_dias,
      condPagamento: p.cond_pagamento,
      prazoPagamentoDias: p.prazo_pagamento_dias,
      descontoPct: p.desconto_pct,
      validadeDias: p.validade_dias,
      observacoes: p.observacoes,
      enviadaEm: p.enviada_em,
      itensCotados: parciais.length,
      itensTotais: itens.length,
      cobertura: itens.length ? parciais.length / itens.length : 0,
      completa: parciais.length === itens.length,
      totalBruto: cent(totalBruto),
      totalDesconto: cent(totalDesconto),
      totalImpostos: cent(totalImpostos),
      totalFrete: cent(totalFrete),
      totalCustoPosto: cent(totalCustoPosto),
      totalFinal: cent(totalFinal),
      posicao: null,
      vencedorGlobal: false,
      itensVencidos: 0,
      deltaVsMelhor: 0,
    })
  }

  // ---------- 2. menor preco POR ITEM ----------
  const idPorFornecedor = new Map(propostas.map((p) => [p.id, p.fornecedor_id]))
  const itensEqualizados: ItemEqualizado[] = itens.map((it) => {
    const ofertas: OfertaItem[] = []
    for (const p of propostas) {
      const o = custos.get(`${p.id}:${it.id}`)
      if (o) ofertas.push({ ...o })
    }
    ofertas.sort((a, b) => a.custoFinal - b.custoFinal)
    const melhor = ofertas[0] ?? null
    if (melhor) {
      melhor.vencedor = true
      for (const o of ofertas) o.deltaVsMelhor = melhor.custoFinal > 0 ? o.custoFinal / melhor.custoFinal - 1 : 0
    }
    const maior = ofertas.length ? ofertas[ofertas.length - 1].custoFinal : 0
    return {
      cotacaoItemId: it.id,
      materialId: it.material_id,
      codigo: it.codigo,
      descricao: it.descricao,
      unidade: it.unidade,
      quantidade: it.quantidade,
      precoReferencia: it.preco_referencia,
      referenciaTotal: cent(it.preco_referencia * it.quantidade),
      ofertas,
      vencedor: melhor,
      dispersao: melhor && melhor.custoFinal > 0 ? maior / melhor.custoFinal - 1 : 0,
    }
  })

  // contagem de itens vencidos por fornecedor
  const vencidosPor = new Map<number, number>()
  for (const it of itensEqualizados) {
    if (!it.vencedor) continue
    vencidosPor.set(it.vencedor.fornecedorId, (vencidosPor.get(it.vencedor.fornecedorId) ?? 0) + 1)
  }
  for (const r of resumos) r.itensVencidos = vencidosPor.get(r.fornecedorId) ?? 0

  // ---------- 3. menor preco GLOBAL por fornecedor ----------
  // apenas propostas que cobrem 100% dos itens disputam a compra global
  const completos = resumos.filter((r) => r.completa).sort((a, b) => a.totalFinal - b.totalFinal)
  completos.forEach((r, i) => { r.posicao = i + 1 })
  const melhorGlobal = completos[0] ?? null
  if (melhorGlobal) {
    melhorGlobal.vencedorGlobal = true
    for (const r of completos) {
      r.deltaVsMelhor = melhorGlobal.totalFinal > 0 ? r.totalFinal / melhorGlobal.totalFinal - 1 : 0
    }
  }
  // parciais aparecem depois dos completos, ordenados por cobertura e valor
  const parciaisOrd = resumos.filter((r) => !r.completa)
    .sort((a, b) => b.cobertura - a.cobertura || a.totalFinal - b.totalFinal)

  const totalReferencia = itensEqualizados.reduce((s, i) => s + i.referenciaTotal, 0)
  const totalMelhorPorItem = itensEqualizados.reduce((s, i) => s + (i.vencedor?.custoFinal ?? 0), 0)
  const totalMelhorGlobal = melhorGlobal?.totalFinal ?? 0
  // Referencias de mercado apuradas na propria disputa: e assim que a area de
  // compras mede economia — contra a media e o teto das propostas recebidas.
  const completosValores = completos.map((r) => r.totalFinal)
  const totalMediaPropostas = completosValores.length
    ? completosValores.reduce((s2, v) => s2 + v, 0) / completosValores.length : 0
  const totalMaiorProposta = completosValores.length ? Math.max(...completosValores) : 0

  const fornecedoresNaPulverizacao = new Set(
    itensEqualizados.filter((i) => i.vencedor).map((i) => i.vencedor!.fornecedorId)
  ).size

  return {
    itens: itensEqualizados,
    fornecedores: [...completos, ...parciaisOrd],
    totalReferencia: cent(totalReferencia),
    melhorGlobal,
    totalMelhorGlobal: cent(totalMelhorGlobal),
    totalMelhorPorItem: cent(totalMelhorPorItem),
    totalMediaPropostas: cent(totalMediaPropostas),
    totalMaiorProposta: cent(totalMaiorProposta),
    economiaVsMedia: totalMediaPropostas > 0 ? 1 - totalMelhorPorItem / totalMediaPropostas : 0,
    economiaVsMaior: totalMaiorProposta > 0 ? 1 - totalMelhorPorItem / totalMaiorProposta : 0,
    fornecedoresNaPulverizacao,
    economiaGlobalVsReferencia: totalReferencia > 0 && totalMelhorGlobal > 0 ? 1 - totalMelhorGlobal / totalReferencia : 0,
    economiaPorItemVsReferencia: totalReferencia > 0 ? 1 - totalMelhorPorItem / totalReferencia : 0,
    ganhoPulverizacao: cent(Math.max(0, totalMelhorGlobal - totalMelhorPorItem)),
    itensSemOferta: itensEqualizados.filter((i) => !i.vencedor).length,
    parametros,
  }
}
