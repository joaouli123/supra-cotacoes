import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir, exigirEmpresa } from '@/lib/acesso'
import { todos, um } from '@/lib/db'
import { moeda, numero, data, dataHora } from '@/lib/formato'
import { lerRecado } from '@/lib/flash'
import { Painel, CabecalhoPagina, Campo, Vazio, StatusTag, Tag, Aviso } from '@/components/ui'
import { Retorno, Recusa } from '@/components/Acoes'
import { AcaoFluxo, AcaoConfirmada, IncluirItem, RemoverItem } from '@/components/Fluxo'
import {
  IconeLista, IconeDocumento, IconeCotacao, IconeCalendario, IconeConector,
  IconeInfo, IconeDesfazer, IconeCaixa,
} from '@/components/icones'

export const dynamic = 'force-dynamic'

const ROTULO_ORIGEM: Record<string, string> = {
  requisicao: 'Requisição interna', estoque_minimo: 'Estoque mínimo',
  manual: 'Lançamento manual', erp: 'Integração ERP',
}

export default async function PaginaDemanda(
  { params, searchParams }: { params: { id: string }; searchParams: { [k: string]: string | undefined } }
) {
  const s = await exigir('demandas')
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) notFound()

  const d = await um<{
    id: number; empresa_id: number; numero: string; origem: string; solicitante: string
    centro_custo: string; status: string; criado_em: string; empresa: string
  }>(
    `select d.id, d.empresa_id, d.numero, d.origem, d.solicitante, d.centro_custo,
            d.status, d.criado_em, e.nome_fantasia as empresa
       from demandas d join empresas e on e.id = d.empresa_id
      where d.id = ?`, [id])
  if (!d) notFound()
  exigirEmpresa(s, d.empresa_id)

  const itens = await todos<{
    id: number; material_id: number; codigo: string; descricao: string
    unidade: string; quantidade: number; preco_referencia: number
  }>(
    `select di.id, di.material_id, m.codigo, m.descricao, u.sigla as unidade,
            di.quantidade, m.preco_referencia
       from demanda_itens di
       join materiais m on m.id = di.material_id
       join unidades u on u.id = di.unidade_id
      where di.demanda_id = ? order by m.descricao`, [id])

  const estimado = itens.reduce((t, i) => t + i.quantidade * i.preco_referencia, 0)

  const cotacoes = await todos<{ id: number; numero: string; titulo: string; status: string; criado_em: string }>(
    'select id, numero, titulo, status, criado_em from cotacoes where demanda_id = ? order by criado_em desc', [id])

  const aberta = d.status === 'aberta'
  const aqui = `/demandas/${id}`

  // Catalogo visivel para esta empresa: o proprio dela mais o corporativo.
  const materiais = aberta
    ? await todos<{ id: number; codigo: string; descricao: string; sigla: string }>(
        `select m.id, m.codigo, m.descricao, u.sigla
           from materiais m join unidades u on u.id = m.unidade_id
          where m.ativo = 1 and (m.empresa_id is null or m.empresa_id = ?)
          order by m.descricao limit 600`, [d.empresa_id])
    : []

  return (
    <>
      <CabecalhoPagina
        migalhas={[{ rotulo: 'Demandas', href: '/demandas' }, { rotulo: d.numero }]}
        icone={<IconeLista size={19} />}
        titulo={d.numero}
        descricao={`${ROTULO_ORIGEM[d.origem] ?? d.origem} · solicitada por ${d.solicitante}`}
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            <StatusTag status={d.status} />
            {aberta && itens.length > 0 && (
              <Link href={`/cotacoes/nova?demanda=${id}`} className="btn btn-primario btn-sm">
                <IconeCotacao size={15} />Gerar cotação
              </Link>
            )}
            {(d.status === 'aberta' || d.status === 'em_cotacao') && (
              <AcaoConfirmada
                op="demanda.status" id={id} voltar={aqui} extras={{ _status: 'cancelada' }}
                rotulo="Cancelar" tom="critico" confirmar="Cancelar a demanda"
                aviso={<>A requisição sai da fila de compras e deixa de gerar cotação. O registro
                        permanece na base e na auditoria.</>} />
            )}
            {d.status === 'cancelada' && (
              <AcaoFluxo op="demanda.status" id={id} voltar={aqui} extras={{ _status: 'aberta' }}>
                <IconeDesfazer size={15} />Reabrir
              </AcaoFluxo>
            )}
          </div>
        } />

      <Retorno ok={searchParams.ok} />
      <Recusa mensagem={lerRecado(searchParams.f)?.erros._} />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 sm:gap-5">
        <div className="space-y-4 sm:space-y-5 min-w-0">
          <Painel semPadding icone={<IconeCaixa size={15} />} titulo={`Itens da demanda (${itens.length})`}
            acao={<span className="text-xs text-ink-500">Estimado {moeda(estimado)}</span>}>
            {itens.length === 0 ? (
              <Vazio icone={<IconeCaixa size={20} />} titulo="Nenhum item incluído"
                descricao={aberta
                  ? 'Escolha o material e a quantidade abaixo. Cada inclusão é gravada na hora.'
                  : 'A demanda foi encerrada sem itens.'} />
            ) : (
              <div className="rolagem-x">
                <table className="tabela">
                  <thead><tr>
                    <th>Código</th><th>Material</th><th>Un.</th>
                    <th className="num">Quantidade</th><th className="num">Preço ref.</th>
                    <th className="num">Total ref.</th>
                    {aberta && <th className="w-px"><span className="sr-only">Ações</span></th>}
                  </tr></thead>
                  <tbody>
                    {itens.map((i) => (
                      <tr key={i.id}>
                        <td data-x className="texto-mono text-xs text-ink-600 whitespace-nowrap">{i.codigo}</td>
                        <td data-p>
                          <Link href={`/materiais/${i.material_id}`}
                                className="text-sm text-ink-900 hover:text-petrol-700 font-medium md:font-normal transition-colors">
                            {i.descricao}
                          </Link>
                        </td>
                        <td data-r="Unidade" className="text-xs text-ink-600">{i.unidade}</td>
                        <td data-r="Quantidade" className="num text-sm">{numero(i.quantidade)}</td>
                        <td data-r="Preço ref." className="num text-sm">{moeda(i.preco_referencia)}</td>
                        <td data-r="Total ref." className="num text-sm font-medium">
                          {moeda(i.quantidade * i.preco_referencia)}
                        </td>
                        {aberta && (
                          <td data-a>
                            <RemoverItem op="demanda.item.rm" id={id} itemId={i.id} voltar={aqui} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {aberta && (
              <IncluirItem op="demanda.item.add" id={id} voltar={aqui}
                materiais={materiais.map((m) => ({
                  valor: m.id, rotulo: `${m.codigo} — ${m.descricao} (${m.sigla})`,
                }))} />
            )}
          </Painel>

          {cotacoes.length > 0 && (
            <Painel semPadding icone={<IconeCotacao size={15} />} titulo="Cotações geradas">
              <ul className="divide-y divide-ink-100">
                {cotacoes.map((c) => (
                  <li key={c.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <Link href={`/cotacoes/${c.id}`}
                            className="text-sm text-ink-900 hover:text-petrol-700 transition-colors">
                        {c.titulo}
                      </Link>
                      <p className="texto-mono text-2xs text-ink-500 mt-0.5">{c.numero} · {data(c.criado_em)}</p>
                    </div>
                    <StatusTag status={c.status} />
                  </li>
                ))}
              </ul>
            </Painel>
          )}
        </div>

        <aside className="space-y-4 sm:space-y-5">
          <Painel icone={<IconeDocumento size={15} />} titulo="Dados da requisição">
            <dl>
              <Campo rotulo="Número"><span className="texto-mono text-xs">{d.numero}</span></Campo>
              <Campo rotulo="Empresa">{d.empresa}</Campo>
              <Campo rotulo="Origem">
                <Tag variante={d.origem === 'erp' ? 'ativa' : 'neutra'}
                     icone={d.origem === 'erp' ? <IconeConector size={11} /> : undefined}>
                  {ROTULO_ORIGEM[d.origem] ?? d.origem}
                </Tag>
              </Campo>
              <Campo rotulo="Solicitante">{d.solicitante}</Campo>
              <Campo rotulo="Centro de custo"><span className="text-xs">{d.centro_custo}</span></Campo>
              <Campo rotulo="Aberta em" icone={<IconeCalendario size={12} />}>{dataHora(d.criado_em)}</Campo>
              <Campo rotulo="Valor estimado">
                <strong className="tabular font-semibold">{moeda(estimado)}</strong>
              </Campo>
            </dl>
          </Painel>

          <Aviso icone={<IconeInfo size={16} />} titulo="O que acontece a seguir">
            {aberta
              ? 'Com os itens definidos, gerar a cotação copia esta lista para uma rodada nova e move a demanda para “em cotação”. A partir daí a lista não muda mais — os fornecedores cotam sobre ela.'
              : d.status === 'em_cotacao'
                ? 'A demanda está em cotação. Ela volta para “atendida” quando a rodada for equalizada, ou para “aberta” se a cotação for cancelada.'
                : d.status === 'atendida'
                  ? 'A rodada foi equalizada e a demanda está atendida. O histórico completo permanece na cotação de origem.'
                  : 'A demanda foi cancelada. Reabrir devolve a requisição para a fila de compras.'}
          </Aviso>
        </aside>
      </div>
    </>
  )
}
