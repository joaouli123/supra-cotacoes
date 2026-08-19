import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir, exigirEmpresa } from '@/lib/acesso'
import { equalizacaoDa } from '@/lib/consultas'
import { moeda, moedaCurta, numero, percentual, dec } from '@/lib/formato'
import { Painel, CabecalhoPagina, Kpi, GradeKpis, Vazio, Tag, Delta, Barra, Aviso } from '@/components/ui'
import { IconeCheck, IconeAlerta, IconeBalanca, IconeGrafico, IconeMoeda, IconeCamada,
  IconeDocumento, IconeRegua, IconeInfo, IconeChevron, IconeAjuste } from '@/components/icones'

export const dynamic = 'force-dynamic'

export default async function PaginaEqualizacao({ params }: { params: { id: string } }) {
  const s = await exigir('cotacoes')
  const id = Number(params.id)
  const r = await equalizacaoDa(id)
  if (!r) notFound()
  const { cot, eq } = r
  exigirEmpresa(s, cot.empresa_id)

  if (eq.fornecedores.length === 0) {
    return (
      <>
        <CabecalhoPagina
          migalhas={[{ rotulo: 'Cotações', href: '/cotacoes' }, { rotulo: cot.numero, href: `/cotacoes/${id}` }, { rotulo: 'Equalização' }]}
          icone={<IconeBalanca size={19} />} titulo="Equalização automática" />
        <Painel semPadding>
          <Vazio icone={<IconeBalanca size={20} />} titulo="Ainda não há propostas para equalizar"
            descricao="A equalização roda automaticamente assim que o primeiro fornecedor responde." />
        </Painel>
      </>
    )
  }

  const completos = eq.fornecedores.filter((f) => f.completa)
  const parciais = eq.fornecedores.filter((f) => !f.completa)
  const ganhoPct = eq.totalMelhorGlobal > 0 ? eq.ganhoPulverizacao / eq.totalMelhorGlobal : 0

  return (
    <>
      <CabecalhoPagina
        migalhas={[{ rotulo: 'Cotações', href: '/cotacoes' }, { rotulo: cot.numero, href: `/cotacoes/${id}` }, { rotulo: 'Equalização' }]}
        icone={<IconeBalanca size={19} />}
        titulo="Equalização automática"
        descricao={`${cot.titulo} · ${eq.itens.length} itens · ${eq.fornecedores.length} propostas recebidas`}
        acoes={
          <span className="inline-flex items-center gap-2 h-8 px-2.5 rounded-md border border-ink-200
                           bg-ink-50 text-2xs text-ink-500 whitespace-nowrap">
            <IconeAjuste size={13} className="text-ink-400 shrink-0" />
            <span className="uppercase tracking-wider hidden sm:inline">Critérios</span>
            <span className="tabular text-ink-800 font-medium">
              capital {dec(cot.taxa_capital_mes)}%/mês
              {cot.peso_prazo_dia > 0 && ` · prazo ${dec(cot.peso_prazo_dia, 3)}%/dia`}
            </span>
          </span>
        } />

      {/* ------------------------------------------------------ indicadores */}
      <GradeKpis>
        <Kpi icone={<IconeDocumento size={14} />} rotulo="Orçamento de referência" valor={moedaCurta(eq.totalReferencia)}
             apoio="Soma dos preços de catálogo" />
        <Kpi icone={<IconeRegua size={14} />} rotulo="Média das propostas" valor={moedaCurta(eq.totalMediaPropostas)}
             apoio={`${completos.length} propostas completas`} />
        <Kpi icone={<IconeCamada size={14} />} rotulo="Menor preço por item" valor={moedaCurta(eq.totalMelhorPorItem)} tom="positivo"
             apoio={`${eq.fornecedoresNaPulverizacao} fornecedores envolvidos`} />
        <Kpi icone={<IconeMoeda size={14} />} rotulo="Economia apurada" valor={percentual(eq.economiaVsMedia)} tom="positivo"
             apoio={`${moeda(eq.totalMediaPropostas - eq.totalMelhorPorItem)} abaixo da média`} />
      </GradeKpis>

      {/* ------------------------------------------------- decisao automatica */}
      <div className="grid md:grid-cols-2 gap-4 sm:gap-5 mt-4 sm:mt-5">
        {/* estrategia global */}
        <section className="painel p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-ink-400">Estratégia A</p>
              <h2 className="text-sm font-semibold text-ink-900 mt-0.5">Menor preço global por fornecedor</h2>
            </div>
            <Tag variante="neutra">1 fornecedor</Tag>
          </div>

          {eq.melhorGlobal ? (
            <>
              <p className="text-[26px] leading-8 font-semibold tabular tracking-tight text-ink-900">
                {moeda(eq.totalMelhorGlobal)}
              </p>
              <Link href={`/fornecedores/${eq.melhorGlobal.fornecedorId}`}
                    className="mt-2 block text-sm text-ink-900 hover:text-petrol-700 font-medium">
                {eq.melhorGlobal.fornecedor}
              </Link>
              <p className="text-xs text-ink-500 mt-0.5">
                {eq.melhorGlobal.cidade}/{eq.melhorGlobal.uf} · frete {eq.melhorGlobal.freteTipo} ·{' '}
                {eq.melhorGlobal.condPagamento} · entrega em {eq.melhorGlobal.prazoEntregaDias} dias
              </p>
              <dl className="mt-4 pt-4 border-t border-ink-100 space-y-2">
                <div className="flex justify-between text-xs">
                  <dt className="text-ink-500">Contra a média das propostas</dt>
                  <dd className="tabular font-medium text-positive-700">
                    −{percentual(eq.totalMediaPropostas > 0 ? 1 - eq.totalMelhorGlobal / eq.totalMediaPropostas : 0)}
                  </dd>
                </div>
                <div className="flex justify-between text-xs">
                  <dt className="text-ink-500">Vantagem operacional</dt>
                  <dd className="text-ink-700">um pedido, um contrato, um recebimento</dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="flex gap-3 items-start py-4">
              <span className="text-caution-700 mt-0.5"><IconeAlerta size={16} /></span>
              <p className="text-sm text-ink-600">
                Nenhuma proposta cobriu 100% dos itens. A compra global exigiria negociação
                complementar — o sistema mantém a disputa apenas na estratégia por item.
              </p>
            </div>
          )}
        </section>

        {/* estrategia por item */}
        <section className="painel p-4 sm:p-5 border-positive-600/30 bg-positive-100/20">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-positive-700">Estratégia B · recomendada</p>
              <h2 className="text-sm font-semibold text-ink-900 mt-0.5">Menor preço por item</h2>
            </div>
            <Tag variante="positiva">{eq.fornecedoresNaPulverizacao} fornecedores</Tag>
          </div>

          <p className="text-[26px] leading-8 font-semibold tabular tracking-tight text-positive-700">
            {moeda(eq.totalMelhorPorItem)}
          </p>
          <p className="mt-2 text-sm text-ink-700">
            Ganho adicional de <strong className="font-semibold">{moeda(eq.ganhoPulverizacao)}</strong>{' '}
            sobre a melhor compra global.
          </p>
          <div className="mt-3"><Barra valor={Math.min(1, ganhoPct * 8)} cor="bg-positive-600" /></div>

          <dl className="mt-4 pt-4 border-t border-positive-600/20 space-y-2">
            <div className="flex justify-between text-xs">
              <dt className="text-ink-500">Contra a média das propostas</dt>
              <dd className="tabular font-medium text-positive-700">−{percentual(eq.economiaVsMedia)}</dd>
            </div>
            <div className="flex justify-between text-xs">
              <dt className="text-ink-500">Contra a maior proposta</dt>
              <dd className="tabular font-medium text-positive-700">−{percentual(eq.economiaVsMaior)}</dd>
            </div>
            <div className="flex justify-between text-xs">
              <dt className="text-ink-500">Custo operacional</dt>
              <dd className="text-ink-700">{eq.fornecedoresNaPulverizacao} pedidos a emitir</dd>
            </div>
          </dl>
        </section>
      </div>

      {/* -------------------------------------------------- ranking */}
      <div className="mt-4 sm:mt-5">
        <Painel semPadding icone={<IconeGrafico size={15} />} titulo="Classificação das propostas"
          acao={<span className="text-xs text-ink-500 hidden sm:block">Ordenado pelo custo final, já com todas as variáveis</span>}>
          <div className="rolagem-x">
            <table className="tabela col-fixa min-w-[900px]">
              <thead><tr>
                <th>#</th><th className="min-w-[230px]">Fornecedor</th><th className="num">Mercadoria</th>
                <th className="num">Impostos</th><th className="num">Frete</th><th className="num">Custo posto</th>
                <th>Pagamento</th><th className="num">Entrega</th>
                <th className="num">Custo final</th><th className="num">vs. 1º</th><th className="num">Itens 1º lugar</th>
              </tr></thead>
              <tbody>
                {completos.map((f) => (
                  <tr key={f.fornecedorId} className={f.vencedorGlobal ? 'bg-positive-100/40' : ''}>
                    <td className="tabular text-sm font-medium text-ink-500">
                      {f.vencedorGlobal
                        ? <span className="inline-flex items-center gap-1 text-positive-700"><IconeCheck size={13} />1</span>
                        : f.posicao}
                    </td>
                    <td className="min-w-[230px]">
                      <Link href={`/fornecedores/${f.fornecedorId}`}
                            className="text-sm text-ink-900 hover:text-petrol-700 block truncate max-w-[230px]"
                            title={f.fornecedor}>
                        {f.fornecedor}
                      </Link>
                      <span className="block text-2xs text-ink-400 truncate">{f.cidade}/{f.uf} · nota {dec(f.avaliacao, 1)}</span>
                    </td>
                    <td className="num text-sm whitespace-nowrap">{moeda(f.totalBruto - f.totalDesconto)}</td>
                    <td className="num text-sm whitespace-nowrap text-ink-600">{moeda(f.totalImpostos)}</td>
                    <td className="num text-sm whitespace-nowrap text-ink-600">
                      {f.freteTipo === 'CIF' ? <span className="text-2xs text-ink-400">CIF (incluso)</span> : moeda(f.totalFrete)}
                    </td>
                    <td className="num text-sm whitespace-nowrap">{moeda(f.totalCustoPosto)}</td>
                    <td className="text-xs text-ink-600 whitespace-nowrap">{f.condPagamento}</td>
                    <td className="num text-xs text-ink-600 whitespace-nowrap">{f.prazoEntregaDias} d</td>
                    <td className="num text-sm font-semibold whitespace-nowrap">{moeda(f.totalFinal)}</td>
                    <td className="num"><Delta v={f.deltaVsMelhor} /></td>
                    <td className="num text-sm">
                      {f.itensVencidos > 0
                        ? <span className="text-positive-700 font-medium">{f.itensVencidos}</span>
                        : <span className="text-ink-300">—</span>}
                    </td>
                  </tr>
                ))}
                {parciais.map((f) => (
                  <tr key={f.fornecedorId} className="opacity-70">
                    <td className="text-ink-300 text-xs">—</td>
                    <td className="min-w-[230px]">
                      <Link href={`/fornecedores/${f.fornecedorId}`}
                            className="text-sm text-ink-700 hover:text-petrol-700 block truncate max-w-[230px]"
                            title={f.fornecedor}>
                        {f.fornecedor}
                      </Link>
                      <span className="block text-2xs text-caution-700 whitespace-nowrap">
                        proposta parcial · {f.itensCotados} de {f.itensTotais} itens
                      </span>
                    </td>
                    <td className="num text-sm">{moeda(f.totalBruto - f.totalDesconto)}</td>
                    <td className="num text-sm text-ink-600">{moeda(f.totalImpostos)}</td>
                    <td className="num text-sm text-ink-600">{f.freteTipo === 'CIF' ? '—' : moeda(f.totalFrete)}</td>
                    <td className="num text-sm">{moeda(f.totalCustoPosto)}</td>
                    <td className="text-xs text-ink-600 whitespace-nowrap">{f.condPagamento}</td>
                    <td className="num text-xs text-ink-600">{f.prazoEntregaDias} d</td>
                    <td className="num text-sm">{moeda(f.totalFinal)}</td>
                    <td className="num"><span className="text-2xs text-ink-400">fora do global</span></td>
                    <td className="num text-sm">
                      {f.itensVencidos > 0 ? <span className="text-positive-700 font-medium">{f.itensVencidos}</span> : <span className="text-ink-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parciais.length > 0 && (
            <p className="painel-rodape text-xs text-ink-500 flex items-start gap-2">
              <IconeInfo size={14} className="text-ink-400 shrink-0 mt-px" />
              Propostas parciais não disputam o menor preço global — não há como fechar a compra
              completa com elas —, mas continuam competindo item a item.
            </p>
          )}
        </Painel>
      </div>

      {/* -------------------------------------------------- matriz */}
      <div className="mt-4 sm:mt-5">
        <Painel semPadding icone={<IconeCamada size={15} />} titulo="Matriz de equalização"
          acao={<span className="text-xs text-ink-500 hidden lg:block">Custo unitário final · célula destacada = menor preço do item</span>}>
          <div className="rolagem-x">
            <table className="tabela col-fixa">
              <thead>
                <tr>
                  <th className="min-w-[220px]">Item</th>
                  <th className="num">Qtd.</th>
                  <th className="num">Referência</th>
                  {eq.fornecedores.map((f) => (
                    <th key={f.fornecedorId} className="num min-w-[110px]">
                      <span className="block truncate max-w-[130px] normal-case font-semibold text-ink-700"
                            title={f.fornecedor}>
                        {f.fornecedor.split(' ').slice(0, 2).join(' ')}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eq.itens.map((it) => (
                  <tr key={it.cotacaoItemId}>
                    <td className="min-w-[220px]">
                      <span className="texto-mono text-2xs text-ink-400 block">{it.codigo}</span>
                      <Link href={`/materiais/${it.materialId}`}
                            className="text-sm text-ink-900 hover:text-petrol-700 block truncate max-w-[220px]">
                        {it.descricao}
                      </Link>
                    </td>
                    <td className="num text-xs text-ink-600 whitespace-nowrap">{numero(it.quantidade)} {it.unidade}</td>
                    <td className="num text-xs text-ink-500 whitespace-nowrap">{moeda(it.precoReferencia)}</td>
                    {eq.fornecedores.map((f) => {
                      const o = it.ofertas.find((x) => x.fornecedorId === f.fornecedorId)
                      if (!o) return <td key={f.fornecedorId} className="num text-2xs text-ink-300">não cotado</td>
                      return (
                        <td key={f.fornecedorId}
                            className={`num whitespace-nowrap ${o.vencedor ? 'bg-positive-100/60 font-semibold text-positive-700' : 'text-ink-700'}`}>
                          <span className="text-sm">{moeda(o.unitarioFinal)}</span>
                          {!o.vencedor && o.deltaVsMelhor > 0 && (
                            <span className="block text-2xs text-ink-400">+{percentual(o.deltaVsMelhor)}</span>
                          )}
                          {o.vencedor && <span className="block text-2xs text-positive-700">menor preço</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Painel>
      </div>

      {/* -------------------------------------------------- memoria de calculo */}
      <div className="mt-4 sm:mt-5">
        <Painel semPadding icone={<IconeRegua size={15} />} titulo="Memória de cálculo"
          acao={<span className="text-xs text-ink-500 hidden sm:block">Abra um item para ver a composição do preço vencedor</span>}>
          <ul className="divide-y divide-ink-100">
            {eq.itens.filter((i) => i.vencedor).slice(0, 12).map((it) => {
              const o = it.vencedor!
              const etapas: Array<[string, string, string]> = [
                ['1', `Preço unitário ${moeda(o.precoUnitario)} × ${numero(it.quantidade)} ${it.unidade}`, moeda(o.bruto)],
                ['2', `Desconto comercial da proposta`, o.desconto > 0 ? `− ${moeda(o.desconto)}` : '—'],
                ['3', `Impostos (IPI ${o.ipiPct}% + ICMS-ST ${o.icmsStPct}%)`, o.impostos > 0 ? `+ ${moeda(o.impostos)}` : '—'],
                ['4', `Frete rateado por participação no valor`, o.frete > 0 ? `+ ${moeda(o.frete)}` : 'CIF — incluso'],
                ['5', `Custo posto no destino`, moeda(o.custoPosto)],
                ['6', `Valor presente do pagamento a prazo (${dec(cot.taxa_capital_mes)}%/mês)`, moeda(o.valorPresente)],
                ['7', `Penalidade por prazo de entrega`, o.penalidadePrazo > 0 ? `+ ${moeda(o.penalidadePrazo)}` : '—'],
              ]
              return (
                <li key={it.cotacaoItemId}>
                  <details className="group">
                    <summary className="list-none cursor-pointer px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4 hover:bg-ink-50">
                      <span className="texto-mono text-2xs text-ink-400 w-24 shrink-0 hidden sm:block">{it.codigo}</span>
                      <span className="text-sm text-ink-900 flex-1 min-w-0 truncate">{it.descricao}</span>
                      <span className="text-xs text-ink-500 hidden lg:block truncate max-w-[200px]">{o.fornecedor}</span>
                      <span className="text-sm font-semibold tabular text-positive-700 whitespace-nowrap">{moeda(o.custoFinal)}</span>
                      <span className="text-ink-400 group-open:rotate-180 transition-transform shrink-0">
                        <IconeChevron size={15} />
                      </span>
                    </summary>
                    <div className="px-4 sm:px-5 pb-4 pt-1 bg-ink-50">
                      <div className="grid lg:grid-cols-[minmax(0,1fr)_260px] gap-4 lg:gap-5">
                        <ol className="space-y-0">
                          {etapas.map(([n, desc, val]) => (
                            <li key={n} className="flex items-center gap-3 py-1.5 border-b border-ink-200/60 last:border-0">
                              <span className="w-5 h-5 rounded bg-white border border-ink-200 grid place-items-center text-2xs text-ink-500 shrink-0">{n}</span>
                              <span className="text-xs text-ink-600 flex-1">{desc}</span>
                              <span className="text-xs tabular text-ink-900 whitespace-nowrap">{val}</span>
                            </li>
                          ))}
                          <li className="flex items-center gap-3 pt-2.5">
                            <span className="w-5 shrink-0" />
                            <span className="text-xs font-semibold text-ink-900 flex-1">Custo final comparável</span>
                            <span className="text-sm font-semibold tabular text-positive-700">{moeda(o.custoFinal)}</span>
                          </li>
                        </ol>
                        <div className="text-xs text-ink-500 space-y-1.5 lg:border-l lg:border-ink-200 lg:pl-5">
                          <p><span className="text-ink-400">Fornecedor vencedor:</span><br />
                             <strong className="text-ink-800 font-medium">{o.fornecedor}</strong></p>
                          {o.marca && <p><span className="text-ink-400">Marca ofertada:</span> {o.marca}</p>}
                          <p><span className="text-ink-400">Ofertas comparadas:</span> {it.ofertas.length}</p>
                          {it.dispersao > 0 && (
                            <p><span className="text-ink-400">Dispersão do item:</span>{' '}
                               <strong className="text-caution-700 font-medium">+{percentual(it.dispersao)}</strong>{' '}
                               entre a menor e a maior oferta</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
          {eq.itens.filter((i) => i.vencedor).length > 12 && (
            <p className="painel-rodape text-xs text-ink-500 flex items-start gap-2">
              <IconeInfo size={14} className="text-ink-400 shrink-0 mt-px" />
              Exibindo os 12 primeiros itens. A memória de cálculo existe para todos os {eq.itens.length}.
            </p>
          )}
        </Painel>
      </div>

      {eq.itensSemOferta > 0 && (
        <p className="mt-4 flex items-center gap-2 text-xs text-caution-700">
          <IconeAlerta size={14} />
          {eq.itensSemOferta} {eq.itensSemOferta === 1 ? 'item não recebeu' : 'itens não receberam'} nenhuma
          oferta disponível e {eq.itensSemOferta === 1 ? 'permanece' : 'permanecem'} fora da apuração.
        </p>
      )}
    </>
  )
}
