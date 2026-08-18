import Link from 'next/link'
import { notFound } from 'next/navigation'
import { todos, um } from '@/lib/db'
import { cotacao, itensDaCotacao } from '@/lib/consultas'
import { moeda, numero, data, dataHora, dataRelativa, dec } from '@/lib/formato'
import { Painel, CabecalhoPagina, Campo, Vazio, StatusTag, Tag, Barra, Aviso } from '@/components/ui'
import { IconeBalanca, IconeEnvio, IconePorta, IconeCotacao, IconeFabrica, IconeDocumento, IconeAjuste, IconeLista, IconeExterno } from '@/components/icones'

export const dynamic = 'force-dynamic'

export default async function PaginaCotacao({ params }: { params: { id: string } }) {
  const id = Number(params.id)
  const c = await cotacao(id)
  if (!c) notFound()

  const itens = await itensDaCotacao(id)
  const totalReferencia = itens.reduce((s, i) => s + i.preco_referencia * i.quantidade, 0)

  const convidados = await todos<{
    id: number; fornecedor_id: number; fornecedor: string; cnpj: string; cidade: string; uf: string
    token: string; status: string; convidado_em: string; visualizado_em: string | null
    respondido_em: string | null; avaliacao: number
  }>(
    `select cf.id, cf.fornecedor_id, f.razao_social as fornecedor, f.cnpj, f.cidade, f.uf,
            cf.token, cf.status, cf.convidado_em, cf.visualizado_em, cf.respondido_em, f.avaliacao
       from cotacao_fornecedores cf join fornecedores f on f.id = cf.fornecedor_id
      where cf.cotacao_id = ? order by
        case cf.status when 'respondido' then 0 when 'visualizado' then 1 when 'convidado' then 2 else 3 end,
        f.razao_social`, [id])

  const disparos = await todos<{ canal: string; destinatarios: number; entregues: number; falhas: number; origem: string; criado_em: string }>(
    `select canal, destinatarios, entregues, falhas, origem, criado_em
       from disparo_logs where cotacao_id = ? order by criado_em desc`, [id])

  const demanda = c.demanda_id
    ? await um<{ numero: string; origem: string; solicitante: string; centro_custo: string }>(
        'select numero, origem, solicitante, centro_custo from demandas where id = ?', [c.demanda_id])
    : null

  const respondidos = convidados.filter((x) => x.status === 'respondido').length
  const podeEqualizar = respondidos > 0

  return (
    <>
      <CabecalhoPagina
        migalhas={[{ rotulo: 'Cotações', href: '/cotacoes' }, { rotulo: c.numero }]}
        icone={<IconeCotacao size={19} />}
        titulo={c.titulo}
        descricao={`Conduzida por ${c.comprador} · ${c.comprador_cargo}`}
        acoes={
          <div className="flex items-center gap-2">
            <StatusTag status={c.status} />
            {podeEqualizar && (
              <Link href={`/cotacoes/${id}/equalizacao`} className="btn btn-primario">
                <IconeBalanca size={15} />Equalização automática
              </Link>
            )}
          </div>
        } />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 sm:gap-5">
        <div className="space-y-4 sm:space-y-5 min-w-0">
          {/* ---------------------------------------------- itens */}
          <Painel semPadding icone={<IconeLista size={15} />} titulo={`Itens da cotação (${itens.length})`}
            acao={<span className="text-xs text-ink-500">Referência {moeda(totalReferencia)}</span>}>
            {itens.length === 0 ? <Vazio icone={<IconeLista size={20} />} titulo="Sem itens nesta cotação" /> : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead><tr>
                    <th>#</th><th>Código</th><th>Descrição</th><th>Un.</th>
                    <th className="num">Quantidade</th><th className="num">Preço ref.</th><th className="num">Total ref.</th>
                  </tr></thead>
                  <tbody>
                    {itens.map((i, n) => (
                      <tr key={i.id}>
                        <td data-x className="text-xs text-ink-400 tabular">{n + 1}</td>
                        <td data-x className="texto-mono text-xs text-ink-600 whitespace-nowrap">{i.codigo}</td>
                        <td data-p>
                          <Link href={`/materiais/${i.material_id}`}
                                className="text-sm text-ink-900 hover:text-petrol-700 font-medium md:font-normal transition-colors">
                            {i.descricao}
                          </Link>
                          <span className="block texto-mono text-2xs text-ink-500 mt-0.5 md:hidden">{i.codigo}</span>
                        </td>
                        <td data-r="Unidade" className="text-xs text-ink-600">{i.unidade}</td>
                        <td data-r="Quantidade" className="num text-sm">{numero(i.quantidade)}</td>
                        <td data-r="Preço ref." className="num text-sm">{moeda(i.preco_referencia)}</td>
                        <td data-r="Total ref." className="num text-sm font-medium">{moeda(i.preco_referencia * i.quantidade)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>

          {/* ---------------------------------------------- fornecedores */}
          <Painel semPadding icone={<IconeFabrica size={15} />} titulo={`Fornecedores convidados (${convidados.length})`}
            acao={
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-ink-500 tabular">{respondidos} responderam</span>
                <span className="w-20"><Barra valor={convidados.length ? respondidos / convidados.length : 0} cor="bg-positive-600" /></span>
              </div>
            }>
            {convidados.length === 0 ? <Vazio icone={<IconeFabrica size={20} />} titulo="Nenhum fornecedor convidado" descricao="Os fornecedores são selecionados pelos grupos de materiais dos itens." /> : (
              <div className="overflow-x-auto">
                <table className="tabela">
                  <thead><tr>
                    <th>Fornecedor</th><th>Praça</th><th>Convidado</th>
                    <th>Visualizou</th><th>Respondeu</th><th>Situação</th><th>Portal</th>
                  </tr></thead>
                  <tbody>
                    {convidados.map((f) => (
                      <tr key={f.id}>
                        <td data-p>
                          <Link href={`/fornecedores/${f.fornecedor_id}`}
                                className="text-sm text-ink-900 hover:text-petrol-700 font-medium md:font-normal transition-colors">
                            {f.fornecedor}
                          </Link>
                          <span className="block text-2xs texto-mono text-ink-500 mt-0.5">{f.cnpj}</span>
                        </td>
                        <td data-r="Praça" className="text-xs text-ink-600 whitespace-nowrap">{f.cidade}/{f.uf}</td>
                        <td data-r="Convidado" className="text-xs text-ink-500 whitespace-nowrap">{data(f.convidado_em)}</td>
                        <td data-r="Visualizou" className="text-xs text-ink-500 whitespace-nowrap">{f.visualizado_em ? dataRelativa(f.visualizado_em) : '—'}</td>
                        <td data-r="Respondeu" className="text-xs text-ink-500 whitespace-nowrap">{f.respondido_em ? dataRelativa(f.respondido_em) : '—'}</td>
                        <td data-r="Situação"><StatusTag status={f.status} /></td>
                        <td data-a>
                          <Link href={`/api/portal?token=${f.token}`} className="btn btn-secundario btn-sm"
                                title="Abrir a visão que o fornecedor recebe">
                            <IconeExterno size={13} />Ver portal
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>

          {/* ---------------------------------------------- disparos */}
          {disparos.length > 0 && (
            <Painel semPadding icone={<IconeEnvio size={15} />} titulo="Histórico de disparos">
              <ul className="divide-y divide-ink-100">
                {disparos.map((d, i) => (
                  <li key={i} className="px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4">
                    <span className="text-ink-400"><IconeEnvio size={15} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-900">
                        Disparo {d.origem === 'agendamento' ? 'automático (agendamento)' : 'manual'} via{' '}
                        {d.canal === 'ambos' ? 'e-mail e portal' : d.canal}
                      </p>
                      <p className="text-xs text-ink-500">
                        {d.entregues} de {d.destinatarios} entregues
                        {d.falhas > 0 && <span className="text-critical-700"> · {d.falhas} falha(s)</span>}
                      </p>
                    </div>
                    <span className="text-xs text-ink-500 whitespace-nowrap">{dataHora(d.criado_em)}</span>
                  </li>
                ))}
              </ul>
            </Painel>
          )}
        </div>

        {/* ---------------------------------------------- lateral */}
        <aside className="space-y-4 sm:space-y-5">
          <Painel icone={<IconeDocumento size={15} />} titulo="Dados da rodada">
            <dl>
              <Campo rotulo="Número"><span className="texto-mono text-xs">{c.numero}</span></Campo>
              <Campo rotulo="Empresa">{c.empresa}</Campo>
              <Campo rotulo="Tipo de disparo">
                <Tag variante={c.disparo_tipo === 'programado' ? 'ativa' : 'neutra'}>
                  {c.disparo_tipo === 'programado' ? 'Programado' : 'Manual'}
                </Tag>
              </Campo>
              <Campo rotulo="Canal">{c.canal === 'ambos' ? 'E-mail e portal' : c.canal === 'email' ? 'E-mail' : 'Portal'}</Campo>
              <Campo rotulo="Criada em">{data(c.criado_em)}</Campo>
              <Campo rotulo="Disparada em">{c.disparado_em ? dataHora(c.disparado_em) : '—'}</Campo>
              <Campo rotulo="Encerra em">{c.encerra_em ? dataHora(c.encerra_em) : '—'}</Campo>
            </dl>
          </Painel>

          <Painel icone={<IconeAjuste size={15} />} titulo="Parâmetros de equalização">
            <dl>
              <Campo rotulo="Taxa de capital"><strong className="tabular font-semibold">{dec(c.taxa_capital_mes)}%</strong> a.m.</Campo>
              <Campo rotulo="Peso do prazo de entrega">
                {c.peso_prazo_dia > 0 ? <><strong className="tabular font-semibold">{dec(c.peso_prazo_dia, 3)}%</strong> ao dia</> : 'Não considerado'}
              </Campo>
            </dl>
            <p className="mt-3 pt-3 border-t border-ink-100 text-xs text-ink-500">
              Estes parâmetros ficam congelados na cotação: uma rodada antiga é sempre reproduzível
              com os critérios vigentes à época.
            </p>
          </Painel>

          {demanda && (
            <Painel icone={<IconeLista size={15} />} titulo="Demanda de origem">
              <dl>
                <Campo rotulo="Requisição"><span className="texto-mono text-xs">{demanda.numero}</span></Campo>
                <Campo rotulo="Origem">{demanda.origem === 'estoque_minimo' ? 'Estoque mínimo' : demanda.origem === 'erp' ? 'Integração ERP' : demanda.origem === 'requisicao' ? 'Requisição interna' : 'Manual'}</Campo>
                <Campo rotulo="Solicitante">{demanda.solicitante}</Campo>
                <Campo rotulo="Centro de custo"><span className="text-xs">{demanda.centro_custo}</span></Campo>
              </dl>
            </Painel>
          )}
        </aside>
      </div>
    </>
  )
}
