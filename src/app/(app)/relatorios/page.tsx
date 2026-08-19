// =====================================================================
// Relatorios.
//
// A tela responde a pergunta que a diretoria faz no fim do mes: quanto a
// area de compras economizou, de onde veio essa economia e quem esta
// respondendo. Tudo em cima do periodo escolhido, e tudo exportavel — o
// numero que aparece aqui e o mesmo que sai no CSV.
//
// Nao ha nenhum JavaScript nesta pagina: os graficos chegam ja desenhados
// em SVG e o filtro de periodo e link. Abre rapido no celular da obra e
// imprime direito para anexar em ata.
// =====================================================================
import Link from 'next/link'
import { exigir } from '@/lib/acesso'
import { relatorio, PERIODOS, periodoDe } from '@/lib/relatorios'
import { moeda, moedaCurta, numero, percentual, dec } from '@/lib/formato'
import { Painel, CabecalhoPagina, GradeKpis, Kpi, Barra, Vazio, Tag, Aviso } from '@/components/ui'
import { GraficoArea, GraficoColunas, GraficoBarras, GraficoRosca, CORES } from '@/components/Graficos'
import {
  IconeGrafico, IconeBaixar, IconeMoeda, IconeBalanca, IconeCotacao, IconeLista,
  IconeEnvio, IconeRelogio, IconeFabrica, IconeCaixa, IconeCamada, IconeQueda,
} from '@/components/icones'

export const dynamic = 'force-dynamic'

/** Duracao em horas escrita como gente fala. */
function duracao(h: number): string {
  if (h <= 0) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${dec(h, 1)} h`
  return `${dec(h / 24, 1)} dias`
}

const CORES_CURVA: Record<string, string> = { A: CORES[0], B: CORES[1], C: CORES[3] }

export default async function PaginaRelatorios(
  { searchParams }: { searchParams: { [k: string]: string | undefined } }
) {
  const s = await exigir('relatorios')
  const eid = s.empresa?.id ?? null
  const dias = periodoDe(searchParams.periodo)
  const r = await relatorio(eid, dias)

  const rodadas = r.cotacoesPorMes.reduce((t, m) => t + m.valor, 0)
  const requisicoes = r.demandasPorMes.reduce((t, m) => t + m.valor, 0)

  // A curva acumulada e o que a diretoria olha: economia do mes isolado
  // oscila com o calendario de compras, o acumulado mostra a tendencia.
  let soma = 0
  const acumulada = r.economiaPorMes.map((m) => ({ rotulo: m.rotulo, valor: (soma += m.valor) }))

  const entrega = r.enviados > 0 ? r.entregues / r.enviados : 0
  const valorCurva = r.porCurva.reduce((t, c) => t + c.valor, 0)

  return (
    <>
      <CabecalhoPagina
        icone={<IconeGrafico size={18} />}
        titulo="Relatórios"
        descricao="Economia apurada, volume de rodadas, resposta dos fornecedores e concentração de gasto — no período que você escolher."
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-0.5 p-1 rounded-lg border border-ink-200 bg-white">
              {PERIODOS.map((p) => (
                <Link key={p.valor} href={`/relatorios?periodo=${p.valor}`}
                      title={p.rotulo}
                      className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
                        p.valor === String(dias)
                          ? 'bg-petrol-700 text-white font-medium'
                          : 'text-ink-600 hover:bg-ink-100'}`}>
                  {p.curto}
                </Link>
              ))}
            </div>
            <Link href={`/api/relatorios?periodo=${dias}`} className="btn btn-secundario btn-sm">
              <IconeBaixar size={15} />Exportar CSV
            </Link>
          </div>
        } />

      {/* ================================================== resultado ==== */}

      <GradeKpis>
        <Kpi rotulo="Economia apurada" icone={<IconeMoeda size={14} />} tom="positivo"
             valor={moedaCurta(r.economiaValor)}
             apoio={<>{percentual(r.economiaPct)} abaixo da referência</>} />
        <Kpi rotulo="Valor negociado" icone={<IconeBalanca size={14} />}
             valor={moedaCurta(r.contratado)}
             apoio={<>referência {moedaCurta(r.referencia)}</>} />
        <Kpi rotulo="Rodadas equalizadas" icone={<IconeCotacao size={14} />}
             valor={numero(r.equalizadas)}
             apoio={<>de {numero(rodadas)} abertas no período</>} />
        <Kpi rotulo="Ganho por pulverização" icone={<IconeQueda size={14} />}
             valor={moedaCurta(r.ganhoPulverizacao)}
             apoio="dividindo o pedido entre fornecedores" />
      </GradeKpis>

      <div className="h-3 sm:h-4" />

      <GradeKpis>
        <Kpi rotulo="Convites enviados" icone={<IconeEnvio size={14} />}
             valor={numero(r.convites)}
             apoio={<>{numero(requisicoes)} requisições no período</>} />
        <Kpi rotulo="Taxa de resposta" icone={<IconeFabrica size={14} />}
             tom={r.taxaResposta >= 0.5 ? 'positivo' : 'atencao'}
             valor={percentual(r.taxaResposta)}
             apoio={<>{numero(r.respondidos)} propostas recebidas</>} />
        <Kpi rotulo="Resposta mediana" icone={<IconeRelogio size={14} />}
             valor={duracao(r.respostaMediana)}
             apoio={<>média de {duracao(r.respostaMedia)}</>} />
        <Kpi rotulo="Entrega dos disparos" icone={<IconeCamada size={14} />}
             tom={r.falhas > 0 ? 'atencao' : 'neutro'}
             valor={r.enviados > 0 ? percentual(entrega) : '—'}
             apoio={<>{numero(r.falhas)} falha(s) em {numero(r.enviados)} envios</>} />
      </GradeKpis>

      {/* ================================================== economia ===== */}

      <div className="mt-3 sm:mt-4">
        <Painel titulo="Economia acumulada no período" icone={<IconeMoeda size={15} />}
                acao={<span className="text-2xs text-ink-500">
                  apurada no encerramento de cada equalização
                </span>}>
          <GraficoArea dados={acumulada} formatar={moedaCurta} altura={210} />
        </Painel>
      </div>

      {/* ==================================================== volume ===== */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
        <Painel titulo="Cotações abertas por mês" icone={<IconeCotacao size={15} />}
                acao={<span className="text-2xs text-ink-500">{numero(rodadas)} no total</span>}>
          <GraficoColunas dados={r.cotacoesPorMes} formatar={numero} />
        </Painel>

        <Painel titulo="Requisições recebidas por mês" icone={<IconeLista size={15} />}
                acao={<span className="text-2xs text-ink-500">{numero(requisicoes)} no total</span>}>
          <GraficoColunas dados={r.demandasPorMes} formatar={numero} cor={CORES[3]} />
        </Painel>
      </div>

      {/* =============================================== composicoes ===== */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
        <Painel titulo="Situação das rodadas" icone={<IconeCotacao size={15} />}>
          <GraficoRosca fatias={r.porStatus} centro={numero(rodadas)} apoio="cotações" />
        </Painel>

        <Painel titulo="Retorno dos convites" icone={<IconeEnvio size={15} />}>
          <GraficoRosca fatias={r.situacaoConvite} centro={percentual(r.taxaResposta)} apoio="responderam" />
        </Painel>

        <Painel titulo="Origem das requisições" icone={<IconeLista size={15} />}>
          <GraficoRosca fatias={r.porOrigem} centro={numero(requisicoes)} apoio="requisições" />
        </Painel>

        <Painel titulo="Canal de disparo" icone={<IconeCamada size={15} />}>
          <GraficoRosca fatias={r.porCanal} centro={numero(rodadas)} apoio="rodadas" />
        </Painel>
      </div>

      {/* ============================================== fornecedores ===== */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
        <Painel titulo="Fornecedores mais acionados" icone={<IconeFabrica size={15} />} semPadding>
          {r.topFornecedores.length === 0 ? (
            <Vazio icone={<IconeFabrica size={20} />} titulo="Nenhum convite no período"
                   descricao="Assim que uma rodada for disparada, o desempenho de cada fornecedor aparece aqui." />
          ) : (
            <div className="rolagem-x">
              <table className="tabela">
                <thead><tr>
                  <th>Fornecedor</th>
                  <th className="num">Convites</th>
                  <th className="num">Respostas</th>
                  <th className="w-32">Retorno</th>
                  <th className="num">Nota</th>
                </tr></thead>
                <tbody>
                  {r.topFornecedores.map((f) => (
                    <tr key={f.id}>
                      <td className="text-sm text-ink-900 max-w-[220px] truncate">{f.nome}</td>
                      <td className="num text-sm">{numero(f.convites)}</td>
                      <td className="num text-sm">{numero(f.respostas)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Barra valor={f.taxa} cor={f.taxa >= 0.5 ? 'bg-positive-600' : 'bg-caution-600'} />
                          <span className="text-2xs tabular text-ink-600 w-9 text-right">
                            {Math.round(f.taxa * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="num text-sm tabular">{dec(f.avaliacao, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Painel>

        <Painel titulo="Materiais de maior valor cotado" icone={<IconeCaixa size={15} />}
                acao={<span className="text-2xs text-ink-500">a preço de referência</span>}>
          <GraficoBarras
            formatar={moedaCurta}
            dados={r.topMateriais.map((m) => ({
              rotulo: m.descricao,
              valor: m.valor,
              apoio: `${m.codigo} · curva ${m.curva} · ${numero(m.rodadas)} rodada(s)`,
            }))} />
        </Painel>
      </div>

      {/* =================================================== curva ABC === */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
        <Painel titulo="Concentração por curva ABC" icone={<IconeCamada size={15} />}>
          <GraficoRosca
            centro={moedaCurta(valorCurva)} apoio="cotado"
            fatias={r.porCurva.map((c) => ({
              rotulo: `Curva ${c.curva}`, valor: Math.round(c.valor), cor: CORES_CURVA[c.curva],
            }))} />
          <ul className="mt-4 pt-3 border-t border-ink-100 space-y-1.5">
            {r.porCurva.map((c) => (
              <li key={c.curva} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-ink-600">
                  Curva {c.curva} · {numero(c.itens)} linha(s) cotada(s)
                </span>
                <span className="tabular text-ink-900 font-medium">{moeda(c.valor)}</span>
              </li>
            ))}
            {r.porCurva.length === 0 && <li className="text-xs text-ink-400">Sem itens no período.</li>}
          </ul>
        </Painel>

        <Painel titulo="Base cadastral disponível" icone={<IconeCaixa size={15} />}>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-ink-50 border border-ink-100">
              <dt className="text-2xs text-ink-500 mb-1">Materiais ativos</dt>
              <dd className="text-xl font-semibold text-ink-900 tabular">{numero(r.materiais)}</dd>
            </div>
            <div className="p-3 rounded-lg bg-ink-50 border border-ink-100">
              <dt className="text-2xs text-ink-500 mb-1">Fornecedores</dt>
              <dd className="text-xl font-semibold text-ink-900 tabular">{numero(r.fornecedores)}</dd>
            </div>
            <div className="p-3 rounded-lg bg-ink-50 border border-ink-100">
              <dt className="text-2xs text-ink-500 mb-1">Homologados</dt>
              <dd className="text-xl font-semibold text-positive-700 tabular">{numero(r.homologados)}</dd>
            </div>
          </dl>

          <div className="mt-4 pt-3 border-t border-ink-100 space-y-2 text-xs text-ink-600">
            <p className="flex items-center justify-between gap-3">
              <span>Disparos registrados</span>
              <span className="tabular text-ink-900 font-medium">{numero(r.disparos)}</span>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span>Disparos automáticos (agendamento)</span>
              <span className="tabular text-ink-900 font-medium">{numero(r.automaticos)}</span>
            </p>
            <p className="flex items-center justify-between gap-3">
              <span>E-mails entregues</span>
              <span className="tabular text-ink-900 font-medium">
                {numero(r.entregues)} de {numero(r.enviados)}
              </span>
            </p>
          </div>

          {r.homologados < r.fornecedores && (
            <div className="mt-3">
              <Aviso tom="atencao">
                {numero(r.fornecedores - r.homologados)} fornecedor(es) ativo(s) ainda não estão
                homologados e por isso não entram em nenhuma rodada.
              </Aviso>
            </div>
          )}
        </Painel>
      </div>

      {/* ================================================== ranking ====== */}

      <div className="mt-3 sm:mt-4">
        <Painel titulo="Rodadas com maior retorno" icone={<IconeBalanca size={15} />} semPadding
                acao={<span className="text-2xs text-ink-500">
                  {numero(r.equalizadas)} equalizada(s) no período
                </span>}>
          {r.ranking.length === 0 ? (
            <Vazio icone={<IconeBalanca size={20} />} titulo="Nenhuma rodada equalizada no período"
                   descricao="A economia é apurada quando a equalização de uma cotação é concluída."
                   acao={<Link href="/cotacoes" className="btn btn-secundario btn-sm">Ver cotações</Link>} />
          ) : (
            <div className="rolagem-x">
              <table className="tabela tabela-cartoes">
                <thead><tr>
                  <th>Cotação</th><th>Título</th>
                  <th className="num">Referência</th>
                  <th className="num">Contratado</th>
                  <th className="num">Economia</th>
                  <th className="w-32">Redução</th>
                  <th className="w-px"><span className="sr-only">Ações</span></th>
                </tr></thead>
                <tbody>
                  {r.ranking.map((c) => {
                    const ganho = c.referencia - c.melhor
                    const pct = c.referencia > 0 ? ganho / c.referencia : 0
                    return (
                      <tr key={c.id}>
                        <td data-p>
                          <Link href={`/cotacoes/${c.id}`}
                                className="texto-mono text-sm text-ink-900 hover:text-petrol-700 font-medium md:font-normal transition-colors">
                            {c.numero}
                          </Link>
                        </td>
                        <td data-r="Título" className="text-sm text-ink-700 max-w-[280px] truncate">{c.titulo}</td>
                        <td data-r="Referência" className="num text-sm whitespace-nowrap">{moeda(c.referencia)}</td>
                        <td data-r="Contratado" className="num text-sm whitespace-nowrap">{moeda(c.melhor)}</td>
                        <td data-r="Economia" className="num text-sm whitespace-nowrap font-medium text-positive-700">
                          {moeda(ganho)}
                        </td>
                        <td data-r="Redução">
                          <div className="flex items-center gap-2">
                            <Barra valor={pct} cor="bg-positive-600" />
                            <span className="text-2xs tabular text-ink-600 w-9 text-right">
                              {Math.round(pct * 100)}%
                            </span>
                          </div>
                        </td>
                        <td data-a>
                          <Link href={`/cotacoes/${c.id}/equalizacao`} className="btn btn-secundario btn-sm">
                            Equalização
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Painel>
      </div>

      {/* =================================================== metodo ====== */}

      <div className="mt-3 sm:mt-4">
        <Aviso tom="neutro" titulo="Como estes números são apurados">
          <ul className="space-y-1 mt-1">
            <li>
              <b>Economia</b> é a diferença entre o valor de referência do item — o preço cadastrado
              no catálogo — e o valor efetivamente contratado na equalização. Só entram rodadas com
              status <Tag variante="positiva">equalizada</Tag>, pelo mês em que foram encerradas.
            </li>
            <li>
              <b>Ganho por pulverização</b> é o quanto se ganha ao fechar cada item com o melhor
              fornecedor daquele item, em vez de dar a rodada inteira ao melhor fornecedor global.
            </li>
            <li>
              <b>Tempo de resposta</b> conta do convite até a proposta chegar, desprezando respostas
              com mais de 90 dias — que são rodadas reabertas, não demora do fornecedor.
            </li>
            <li>
              Todos os valores respeitam a empresa em contexto
              {s.empresa ? <> — <b>{s.empresa.nome_fantasia}</b></> : ' — visão consolidada da plataforma'}.
            </li>
          </ul>
        </Aviso>
      </div>
    </>
  )
}
