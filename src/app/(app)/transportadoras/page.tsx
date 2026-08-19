import Link from 'next/link'
import { exigir } from '@/lib/acesso'
import { filtroEmpresa } from '@/lib/sessao'
import { todos, um } from '@/lib/db'
import { Painel, Paginacao, CabecalhoPagina, Vazio, Tag } from '@/components/ui'
import { Filtros, TempoConsulta } from '@/components/Filtros'
import { IconeCaminhao, IconeBusca, IconeLocal } from '@/components/icones'

export const dynamic = 'force-dynamic'
const POR_PAGINA = 40

export default async function PaginaTransportadoras({ searchParams }: { searchParams: { [k: string]: string | undefined } }) {
  const s = await exigir('cadastros')
  const eid = s.empresa?.id ?? null
  const q = (searchParams.q ?? '').trim()
  const modal = searchParams.modal ?? ''
  const abrangencia = searchParams.abrangencia ?? ''
  const uf = searchParams.uf ?? ''
  const pagina = Math.max(1, Number(searchParams.pagina ?? 1))

  const modais = await todos<{ modal: string }>('select distinct modal from transportadoras order by modal')
  const abrangencias = await todos<{ abrangencia: string }>('select distinct abrangencia from transportadoras order by abrangencia')
  const ufs = await todos<{ uf: string }>('select distinct uf from transportadoras order by uf')

  const cond: string[] = ['t.ativo = 1']
  const par: Array<string | number> = []
  const fe = filtroEmpresa(eid, 't')
  cond.push(fe.sql); par.push(...fe.params)
  if (q) { cond.push('(t.razao_social like ? or t.nome_fantasia like ? or t.cnpj like ? or t.cidade like ?)'); par.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`) }
  if (modal) { cond.push('t.modal = ?'); par.push(modal) }
  if (abrangencia) { cond.push('t.abrangencia = ?'); par.push(abrangencia) }
  if (uf) { cond.push('t.uf = ?'); par.push(uf) }
  const onde = cond.join(' and ')

  const inicio = process.hrtime.bigint()
  const total = (await um<{ c: number }>(`select count(*) c from transportadoras t where ${onde}`, par))?.c ?? 0
  const linhas = await todos<{
    id: number; razao_social: string; nome_fantasia: string; cnpj: string; email: string
    cidade: string; uf: string; modal: string; abrangencia: string; prazo_medio_dias: number
  }>(`select t.* from transportadoras t where ${onde} order by t.razao_social limit ? offset ?`,
    [...par, POR_PAGINA, (pagina - 1) * POR_PAGINA])
  const ms = Number(process.hrtime.bigint() - inicio) / 1e6
  const universo = (await um<{ c: number }>('select count(*) c from transportadoras'))?.c ?? 0

  return (
    <>
      <CabecalhoPagina
        icone={<IconeCaminhao size={19} />}
        titulo="Transportadoras"
        descricao="Base logística usada no cálculo de frete e prazo dentro da equalização."
        acoes={<TempoConsulta ms={ms} registros={universo} />} />

      <Filtros acao="/transportadoras" busca={q} placeholder="Buscar por razão social, CNPJ ou cidade…"
        selects={[
          { nome: 'modal', valor: modal, vazio: 'Todos os modais', rotulo: 'Modal',
            opcoes: modais.map((x) => ({ valor: x.modal, rotulo: x.modal })) },
          { nome: 'abrangencia', valor: abrangencia, vazio: 'Toda abrangência', rotulo: 'Abrangência',
            opcoes: abrangencias.map((x) => ({ valor: x.abrangencia, rotulo: x.abrangencia })) },
          { nome: 'uf', valor: uf, vazio: 'Todas as UFs', rotulo: 'UF',
            opcoes: ufs.map((x) => ({ valor: x.uf, rotulo: x.uf })) },
        ]} />

      <Painel semPadding>
        {linhas.length === 0 ? (
          <Vazio icone={<IconeBusca size={20} />} titulo="Nenhuma transportadora encontrada"
            descricao="Ajuste a busca ou remova algum filtro."
            acao={<Link href="/transportadoras" className="btn btn-secundario btn-sm">Limpar filtros</Link>} />
        ) : (
          <>
            <div className="rolagem-x">
              <table className="tabela tabela-cartoes">
                <thead><tr>
                  <th>Razão social</th><th>CNPJ</th><th>Base</th><th>Modal</th>
                  <th>Abrangência</th><th className="num">Prazo médio</th><th>Contato</th>
                </tr></thead>
                <tbody>
                  {linhas.map((t) => (
                    <tr key={t.id}>
                      <td data-p>
                        <span className="text-sm text-ink-900 font-medium md:font-normal">{t.razao_social}</span>
                        <span className="block text-2xs text-ink-500 mt-0.5">{t.nome_fantasia}</span>
                      </td>
                      <td data-r="CNPJ" className="texto-mono text-xs text-ink-600 whitespace-nowrap">{t.cnpj}</td>
                      <td data-r="Base" className="text-sm text-ink-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <IconeLocal size={13} className="text-ink-400 hidden md:inline" />{t.cidade}/{t.uf}
                        </span>
                      </td>
                      <td data-r="Modal" className="text-xs text-ink-600 whitespace-nowrap">{t.modal}</td>
                      <td data-r="Abrangência"><Tag variante="neutra">{t.abrangencia}</Tag></td>
                      <td data-r="Prazo médio" className="num text-sm whitespace-nowrap">{t.prazo_medio_dias} d</td>
                      <td data-r="Contato" className="text-2xs text-ink-500 truncate max-w-[200px]">{t.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao base={`/transportadoras?q=${encodeURIComponent(q)}&modal=${encodeURIComponent(modal)}&abrangencia=${encodeURIComponent(abrangencia)}&uf=${uf}`}
              pagina={pagina} porPagina={POR_PAGINA} total={total} />
          </>
        )}
      </Painel>
    </>
  )
}
