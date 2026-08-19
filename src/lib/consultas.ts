import { todos, um } from './db'
import { equalizar, type Equalizacao, type ItemCru, type PropostaCrua, type PropostaItemCru } from './equalizacao'

export type Cotacao = {
  id: number; empresa_id: number; demanda_id: number | null; numero: string; titulo: string
  status: string; disparo_tipo: string; canal: string; criado_em: string
  disparado_em: string | null; encerra_em: string | null; encerrado_em: string | null
  taxa_capital_mes: number; peso_prazo_dia: number
  comprador: string; comprador_cargo: string; empresa: string
}

export async function cotacao(id: number): Promise<Cotacao | undefined> {
  return await um<Cotacao>(
    `select c.*, u.nome as comprador, u.cargo as comprador_cargo, e.nome_fantasia as empresa
       from cotacoes c
       join usuarios u on u.id = c.comprador_id
       join empresas e on e.id = c.empresa_id
      where c.id = ?`, [id])
}

export async function itensDaCotacao(id: number): Promise<ItemCru[]> {
  return await todos<ItemCru>(
    `select ci.id, ci.material_id, m.codigo, m.descricao, un.sigla as unidade,
            ci.quantidade, m.preco_referencia
       from cotacao_itens ci
       join materiais m on m.id = ci.material_id
       join unidades un on un.id = ci.unidade_id
      where ci.cotacao_id = ?
      order by ci.ordem`, [id])
}

export async function propostasDaCotacao(id: number): Promise<PropostaCrua[]> {
  return await todos<PropostaCrua>(
    `select p.id, p.fornecedor_id, f.razao_social as fornecedor, f.cnpj, f.cidade, f.uf,
            f.avaliacao, p.frete_tipo, p.valor_frete, p.prazo_entrega_dias, p.cond_pagamento,
            p.prazo_pagamento_dias, p.desconto_pct, p.validade_dias, p.observacoes, p.enviada_em
       from propostas p
       join fornecedores f on f.id = p.fornecedor_id
      where p.cotacao_id = ?
      order by p.id`, [id])
}

export async function itensDasPropostas(id: number): Promise<PropostaItemCru[]> {
  return await todos<PropostaItemCru>(
    `select pi.proposta_id, pi.cotacao_item_id, pi.preco_unitario, pi.ipi_pct,
            pi.icms_st_pct, pi.marca, pi.disponivel
       from proposta_itens pi
       join propostas p on p.id = pi.proposta_id
      where p.cotacao_id = ?`, [id])
}

/** Carrega a cotacao e executa o motor de equalizacao sobre ela. */
export async function equalizacaoDa(id: number): Promise<{ cot: Cotacao; eq: Equalizacao } | null> {
  const cot = await cotacao(id)
  if (!cot) return null
  const [itens, propostas, itensProp] = await Promise.all([
    itensDaCotacao(id), propostasDaCotacao(id), itensDasPropostas(id),
  ])
  const eq = equalizar(itens, propostas, itensProp,
    { taxaCapitalMes: cot.taxa_capital_mes, pesoPrazoDia: cot.peso_prazo_dia })
  return { cot, eq }
}

/** Economia consolidada das cotacoes ja equalizadas de uma empresa. */
export async function economiaConsolidada(idEmpresa: number | null) {
  const filtro = idEmpresa ? 'and empresa_id = ?' : ''
  const params = idEmpresa ? [idEmpresa] : []
  const ids = await todos<{ id: number }>(
    `select id from cotacoes where status = 'equalizada' ${filtro} order by encerrado_em desc`, params)

  let referencia = 0, contratadoGlobal = 0, contratadoPorItem = 0, itens = 0
  // `global` guarda o total se a rodada inteira fosse dada ao melhor
  // fornecedor unico — e a diferenca para `melhor` que mede o ganho de
  // pulverizar. Sem ele por cotacao, nao da para recortar por periodo.
  const porCotacao: Array<{
    id: number; numero: string; titulo: string
    referencia: number; melhor: number; global: number; economia: number
  }> = []

  for (const { id } of ids) {
    const r = await equalizacaoDa(id)
    if (!r || !r.eq.melhorGlobal) continue
    referencia += r.eq.totalReferencia
    contratadoGlobal += r.eq.totalMelhorGlobal
    contratadoPorItem += r.eq.totalMelhorPorItem
    itens += r.eq.itens.length
    porCotacao.push({
      id, numero: r.cot.numero, titulo: r.cot.titulo,
      referencia: r.eq.totalReferencia, melhor: r.eq.totalMelhorPorItem,
      global: r.eq.totalMelhorGlobal,
      economia: r.eq.totalReferencia > 0 ? 1 - r.eq.totalMelhorPorItem / r.eq.totalReferencia : 0,
    })
  }

  return {
    cotacoes: porCotacao.length,
    itens,
    referencia,
    contratadoGlobal,
    contratadoPorItem,
    economiaValor: referencia - contratadoPorItem,
    economiaPct: referencia > 0 ? 1 - contratadoPorItem / referencia : 0,
    ganhoPulverizacao: Math.max(0, contratadoGlobal - contratadoPorItem),
    porCotacao,
  }
}

/** Caminho hierarquico completo de uma classificacao de nivel 5. */
export async function trilhaClassificacao(id: number) {
  return await todos<{ nivel: number; codigo: string; nome: string }>(
    `with recursive trilha(id, nivel, codigo, nome, pai_id) as (
       select id, nivel, codigo, nome, pai_id from classificacoes where id = ?
       union all
       select c.id, c.nivel, c.codigo, c.nome, c.pai_id
         from classificacoes c join trilha t on c.id = t.pai_id
     )
     select nivel, codigo, nome from trilha order by nivel`, [id])
}
