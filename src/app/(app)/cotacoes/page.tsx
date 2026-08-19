import Link from 'next/link'
import { exigir } from '@/lib/acesso'
import { todos, um } from '@/lib/db'
import { numero, data, dataRelativa } from '@/lib/formato'
import { Painel, Paginacao, CabecalhoPagina, Vazio, StatusTag, Tag, Barra } from '@/components/ui'
import { Filtros } from '@/components/Filtros'
import { Retorno, Recusa } from '@/components/Acoes'
import { lerRecado } from '@/lib/flash'
import { IconeBalanca, IconeBusca, IconeRelogio, IconeEnvio, IconeUsuario, IconeMais } from '@/components/icones'

export const dynamic = 'force-dynamic'
const POR_PAGINA = 25

export default async function PaginaCotacoes({ searchParams }: { searchParams: { [k: string]: string | undefined } }) {
  const s = await exigir('cotacoes')
  const eid = s.empresa?.id ?? null
  const q = (searchParams.q ?? '').trim()
  const status = searchParams.status ?? ''
  const disparo = searchParams.disparo ?? ''
  const pagina = Math.max(1, Number(searchParams.pagina ?? 1))

  const cond: string[] = ['1=1']
  const par: Array<string | number> = []
  if (eid) { cond.push('c.empresa_id = ?'); par.push(eid) }
  if (q) { cond.push('(c.numero like ? or c.titulo like ?)'); par.push(`%${q}%`, `%${q}%`) }
  if (status) { cond.push('c.status = ?'); par.push(status) }
  if (disparo) { cond.push('c.disparo_tipo = ?'); par.push(disparo) }
  const onde = cond.join(' and ')

  const total = (await um<{ c: number }>(`select count(*) c from cotacoes c where ${onde}`, par))?.c ?? 0
  const linhas = await todos<{
    id: number; numero: string; titulo: string; status: string; disparo_tipo: string
    criado_em: string; disparado_em: string | null; encerra_em: string | null
    comprador: string; itens: number; convites: number; respostas: number
  }>(
    `select c.id, c.numero, c.titulo, c.status, c.disparo_tipo, c.criado_em,
            c.disparado_em, c.encerra_em, u.nome as comprador,
            (select count(*) from cotacao_itens where cotacao_id = c.id) itens,
            (select count(*) from cotacao_fornecedores where cotacao_id = c.id) convites,
            (select count(*) from cotacao_fornecedores where cotacao_id = c.id and status='respondido') respostas
       from cotacoes c
       join usuarios u on u.id = c.comprador_id
      where ${onde} order by c.criado_em desc limit ? offset ?`,
    [...par, POR_PAGINA, (pagina - 1) * POR_PAGINA])

  // Uma unica varredura agrupada em vez de quatro contagens separadas
  const porStatus = await todos<{ status: string; c: number | string }>(
    `select status, count(*) c from cotacoes ${eid ? 'where empresa_id = ?' : ''} group by status`,
    eid ? [eid] : [])
  const contarStatus = (st: string) => Number(porStatus.find((x) => x.status === st)?.c ?? 0)

  const resumo = [
    ['Programadas', contarStatus('programada'), 'programada'],
    ['Em andamento', contarStatus('em_andamento'), 'em_andamento'],
    ['Encerradas', contarStatus('encerrada'), 'encerrada'],
    ['Equalizadas', contarStatus('equalizada'), 'equalizada'],
  ] as const

  return (
    <>
      <CabecalhoPagina
        icone={<IconeBalanca size={19} />}
        titulo="Cotações"
        descricao="Histórico completo do que foi disparado e do que foi recebido, com a equalização de cada rodada."
        acoes={<Link href="/cotacoes/nova" className="btn btn-primario btn-sm"><IconeMais size={15} />Nova cotação</Link>} />

      <Retorno ok={searchParams.ok} />
      <Recusa mensagem={lerRecado(searchParams.f)?.erros._} />

      {/* atalhos por status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {resumo.map(([rotulo, valor, st]) => {
          const on = status === st
          return (
            <Link key={st} href={on ? '/cotacoes' : `/cotacoes?status=${st}`}
                  className={`painel px-4 py-3 flex items-center justify-between gap-3 transition-colors
                              ${on ? 'border-ink-900 bg-ink-50' : 'hover:border-ink-400'}`}>
              <span className="text-xs text-ink-600">{rotulo}</span>
              <span className={`text-lg font-semibold tabular ${on ? 'text-ink-900' : 'text-ink-800'}`}>
                {numero(valor)}
              </span>
            </Link>
          )
        })}
      </div>

      <Filtros acao="/cotacoes" busca={q} placeholder="Buscar por número ou título…"
        selects={[
          { nome: 'status', valor: status, vazio: 'Todos os status', rotulo: 'Status', opcoes: [
            { valor: 'rascunho', rotulo: 'Rascunho' }, { valor: 'programada', rotulo: 'Programada' },
            { valor: 'em_andamento', rotulo: 'Em andamento' }, { valor: 'encerrada', rotulo: 'Encerrada' },
            { valor: 'equalizada', rotulo: 'Equalizada' }, { valor: 'cancelada', rotulo: 'Cancelada' }] },
          { nome: 'disparo', valor: disparo, vazio: 'Qualquer disparo', rotulo: 'Disparo', opcoes: [
            { valor: 'programado', rotulo: 'Disparo programado' }, { valor: 'manual', rotulo: 'Disparo manual' }] },
        ]} />

      <Painel semPadding>
        {linhas.length === 0 ? (
          <Vazio icone={<IconeBusca size={20} />} titulo="Nenhuma cotação encontrada"
            descricao="Ajuste a busca ou abra uma rodada nova."
            acao={<div className="flex flex-wrap justify-center gap-2">
              <Link href="/cotacoes" className="btn btn-secundario btn-sm">Limpar filtros</Link>
              <Link href="/cotacoes/nova" className="btn btn-primario btn-sm"><IconeMais size={15} />Nova cotação</Link>
            </div>} />
        ) : (
          <>
            <div className="rolagem-x">
              <table className="tabela tabela-cartoes">
                <thead><tr>
                  <th>Cotação</th><th>Comprador</th><th>Disparo</th>
                  <th className="num">Itens</th><th>Retorno dos fornecedores</th>
                  <th>Encerra</th><th>Status</th><th></th>
                </tr></thead>
                <tbody>
                  {linhas.map((c) => (
                    <tr key={c.id}>
                      <td data-p>
                        <Link href={`/cotacoes/${c.id}`} className="block group">
                          <span className="text-sm text-ink-900 group-hover:text-petrol-700 font-medium md:font-normal
                                           md:truncate md:max-w-[260px] block transition-colors">
                            {c.titulo}
                          </span>
                          <span className="block texto-mono text-2xs text-ink-500 mt-0.5">{c.numero}</span>
                        </Link>
                      </td>
                      <td data-r="Comprador" className="text-sm text-ink-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <IconeUsuario size={13} className="text-ink-400 hidden md:inline" />
                          {c.comprador.split(' ').slice(0, 2).join(' ')}
                        </span>
                      </td>
                      <td data-r="Disparo" className="whitespace-nowrap">
                        <Tag variante={c.disparo_tipo === 'programado' ? 'ativa' : 'neutra'}
                             icone={c.disparo_tipo === 'programado' ? <IconeRelogio size={11} /> : <IconeEnvio size={11} />}>
                          {c.disparo_tipo === 'programado' ? 'Programado' : 'Manual'}
                        </Tag>
                        <span className="block text-2xs text-ink-400 mt-0.5 md:block hidden">
                          {c.disparado_em ? dataRelativa(c.disparado_em) : 'não disparada'}
                        </span>
                      </td>
                      <td data-r="Itens" className="num text-sm">{numero(c.itens)}</td>
                      <td data-r="Retorno" className="md:min-w-[150px]">
                        <div className="flex items-center gap-2.5 justify-end md:justify-start">
                          <span className="text-xs tabular text-ink-600 md:w-12 shrink-0">
                            {c.respostas}/{c.convites}
                          </span>
                          <span className="w-16 md:flex-1 md:max-w-[90px]">
                            <Barra valor={c.convites ? c.respostas / c.convites : 0}
                              cor={c.respostas === 0 ? 'bg-ink-300' : c.respostas === c.convites ? 'bg-positive-600' : 'bg-caution-600'} />
                          </span>
                        </div>
                      </td>
                      <td data-r="Encerra" className="text-xs text-ink-500 whitespace-nowrap">{data(c.encerra_em)}</td>
                      <td data-r="Status"><StatusTag status={c.status} /></td>
                      <td data-a className="text-right">
                        {c.respostas > 0 && (
                          <Link href={`/cotacoes/${c.id}/equalizacao`} className="btn btn-secundario btn-sm">
                            <IconeBalanca size={13} />Equalizar
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao base={`/cotacoes?q=${encodeURIComponent(q)}&status=${status}&disparo=${disparo}`}
              pagina={pagina} porPagina={POR_PAGINA} total={total} />
          </>
        )}
      </Painel>
    </>
  )
}
