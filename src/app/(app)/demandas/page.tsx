import Link from 'next/link'
import { exigir } from '@/lib/acesso'
import { todos, um } from '@/lib/db'
import { moeda, numero, data } from '@/lib/formato'
import { Painel, Paginacao, CabecalhoPagina, Vazio, StatusTag, Tag } from '@/components/ui'
import { Filtros } from '@/components/Filtros'
import { Retorno, Recusa } from '@/components/Acoes'
import { lerRecado } from '@/lib/flash'
import { IconeLista, IconeBusca, IconeConector, IconeCalendario, IconeMais } from '@/components/icones'

export const dynamic = 'force-dynamic'
const POR_PAGINA = 30

const ROTULO_ORIGEM: Record<string, string> = {
  requisicao: 'Requisição interna', estoque_minimo: 'Estoque mínimo',
  manual: 'Lançamento manual', erp: 'Integração ERP',
}

export default async function PaginaDemandas({ searchParams }: { searchParams: { [k: string]: string | undefined } }) {
  const s = await exigir('demandas')
  const eid = s.empresa?.id ?? null
  const q = (searchParams.q ?? '').trim()
  const origem = searchParams.origem ?? ''
  const status = searchParams.status ?? ''
  const pagina = Math.max(1, Number(searchParams.pagina ?? 1))

  const cond: string[] = ['1=1']
  const par: Array<string | number> = []
  if (eid) { cond.push('d.empresa_id = ?'); par.push(eid) }
  if (q) { cond.push('(d.numero like ? or d.solicitante like ? or d.centro_custo like ?)'); par.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  if (origem) { cond.push('d.origem = ?'); par.push(origem) }
  if (status) { cond.push('d.status = ?'); par.push(status) }
  const onde = cond.join(' and ')

  const total = (await um<{ c: number }>(`select count(*) c from demandas d where ${onde}`, par))?.c ?? 0
  const linhas = await todos<{
    id: number; numero: string; origem: string; solicitante: string; centro_custo: string
    status: string; criado_em: string; itens: number; valor: number | null
    cotacao_id: number | null; cotacao: string | null
  }>(
    `select d.id, d.numero, d.origem, d.solicitante, d.centro_custo, d.status, d.criado_em,
            (select count(*) from demanda_itens where demanda_id = d.id) itens,
            (select sum(di.quantidade * m.preco_referencia) from demanda_itens di
               join materiais m on m.id = di.material_id where di.demanda_id = d.id) valor,
            (select id from cotacoes where demanda_id = d.id limit 1) cotacao_id,
            (select numero from cotacoes where demanda_id = d.id limit 1) cotacao
       from demandas d where ${onde} order by d.criado_em desc limit ? offset ?`,
    [...par, POR_PAGINA, (pagina - 1) * POR_PAGINA])

  return (
    <>
      <CabecalhoPagina
        icone={<IconeLista size={19} />}
        titulo="Demandas de compra"
        descricao="As requisições nascem de várias origens — requisição interna, ponto de reposição, lançamento manual ou integração com o ERP — e alimentam as cotações."
        acoes={<Link href="/demandas/nova" className="btn btn-primario btn-sm"><IconeMais size={15} />Nova demanda</Link>} />

      <Retorno ok={searchParams.ok} />
      <Recusa mensagem={lerRecado(searchParams.f)?.erros._} />

      <Filtros acao="/demandas" busca={q} placeholder="Buscar por número, solicitante ou centro de custo…"
        selects={[
          { nome: 'origem', valor: origem, vazio: 'Todas as origens', rotulo: 'Origem',
            opcoes: Object.entries(ROTULO_ORIGEM).map(([v, r]) => ({ valor: v, rotulo: r })) },
          { nome: 'status', valor: status, vazio: 'Todos os status', rotulo: 'Status', opcoes: [
            { valor: 'aberta', rotulo: 'Aberta' }, { valor: 'em_cotacao', rotulo: 'Em cotação' },
            { valor: 'atendida', rotulo: 'Atendida' }, { valor: 'cancelada', rotulo: 'Cancelada' }] },
        ]} />

      <Painel semPadding>
        {linhas.length === 0 ? (
          <Vazio icone={<IconeBusca size={20} />} titulo="Nenhuma demanda encontrada"
            descricao="Ajuste a busca ou abra uma requisição nova."
            acao={<div className="flex flex-wrap justify-center gap-2">
              <Link href="/demandas" className="btn btn-secundario btn-sm">Limpar filtros</Link>
              <Link href="/demandas/nova" className="btn btn-primario btn-sm"><IconeMais size={15} />Nova demanda</Link>
            </div>} />
        ) : (
          <>
            <div className="rolagem-x">
              <table className="tabela tabela-cartoes">
                <thead><tr>
                  <th>Requisição</th><th>Origem</th><th>Solicitante</th><th>Centro de custo</th>
                  <th className="num">Itens</th><th className="num">Valor estimado</th>
                  <th>Cotação</th><th>Status</th>
                  <th className="w-px"><span className="sr-only">Ações</span></th>
                </tr></thead>
                <tbody>
                  {linhas.map((d) => (
                    <tr key={d.id}>
                      <td data-p>
                        <Link href={`/demandas/${d.id}`}
                              className="texto-mono text-sm text-ink-900 hover:text-petrol-700 font-medium md:font-normal transition-colors">
                          {d.numero}
                        </Link>
                        <span className="block text-2xs text-ink-500 mt-0.5 inline-flex items-center gap-1">
                          <IconeCalendario size={11} className="text-ink-400" />{data(d.criado_em)}
                        </span>
                      </td>
                      <td data-r="Origem">
                        <Tag variante={d.origem === 'erp' ? 'ativa' : 'neutra'}
                             icone={d.origem === 'erp' ? <IconeConector size={11} /> : undefined}>
                          {ROTULO_ORIGEM[d.origem]}
                        </Tag>
                      </td>
                      <td data-r="Solicitante" className="text-sm text-ink-700 whitespace-nowrap">
                        {d.solicitante.split(' ').slice(0, 2).join(' ')}
                      </td>
                      <td data-r="Centro de custo" className="text-xs text-ink-600">{d.centro_custo}</td>
                      <td data-r="Itens" className="num text-sm">{numero(d.itens)}</td>
                      <td data-r="Valor estimado" className="num text-sm whitespace-nowrap font-medium">
                        {d.valor ? moeda(d.valor) : '—'}
                      </td>
                      <td data-r="Cotação">
                        {d.cotacao_id
                          ? <Link href={`/cotacoes/${d.cotacao_id}`} className="texto-mono text-xs text-petrol-700 hover:underline">{d.cotacao}</Link>
                          : <span className="text-xs text-ink-300">—</span>}
                      </td>
                      <td data-r="Status"><StatusTag status={d.status} /></td>
                      <td data-a>
                        <Link href={`/demandas/${d.id}`} className="btn btn-secundario btn-sm">Abrir</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao base={`/demandas?q=${encodeURIComponent(q)}&origem=${origem}&status=${status}`}
              pagina={pagina} porPagina={POR_PAGINA} total={total} />
          </>
        )}
      </Painel>
    </>
  )
}
