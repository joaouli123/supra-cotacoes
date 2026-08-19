import Link from 'next/link'
import { exigir } from '@/lib/acesso'
import { filtroEmpresa } from '@/lib/sessao'
import { todos, um, buscaTextual } from '@/lib/db'
import { numero, dec } from '@/lib/formato'
import { Painel, Paginacao, CabecalhoPagina, Vazio, Tag, Aviso } from '@/components/ui'
import { Filtros, TempoConsulta } from '@/components/Filtros'
import { IconeFabrica, IconeBusca, IconeInfo, IconeEstrela, IconeLocal } from '@/components/icones'

export const dynamic = 'force-dynamic'
const POR_PAGINA = 40

export default async function PaginaFornecedores({ searchParams }: { searchParams: { [k: string]: string | undefined } }) {
  const s = await exigir('cadastros')
  const eid = s.empresa?.id ?? null
  const q = (searchParams.q ?? '').trim()
  const uf = searchParams.uf ?? ''
  const grupo = searchParams.grupo ?? ''
  const situacao = searchParams.situacao ?? ''
  const pagina = Math.max(1, Number(searchParams.pagina ?? 1))

  const ufs = await todos<{ uf: string }>('select distinct uf from fornecedores order by uf')
  const grupos = await todos<{ id: number; nome: string }>('select id, nome from classificacoes where nivel = 1 order by nome')

  const cond: string[] = ['f.ativo = 1']
  const par: Array<string | number | null> = []
  const fe = filtroEmpresa(eid, 'f')
  cond.push(fe.sql); par.push(...fe.params)

  const busca = buscaTextual('fornecedores', 'f', q)
  const juncaoFts = busca.juncao
  if (busca.condicao) { cond.push(busca.condicao); par.push(...busca.params) }
  if (uf) { cond.push('f.uf = ?'); par.push(uf) }
  if (situacao === 'homologado') cond.push('f.homologado = 1')
  if (situacao === 'pendente') cond.push('f.homologado = 0')
  if (grupo) {
    cond.push('exists (select 1 from fornecedor_grupos fg where fg.fornecedor_id = f.id and fg.classificacao_id = ?)')
    par.push(Number(grupo))
  }

  const onde = cond.join(' and ')
  const inicio = process.hrtime.bigint()
  const total = (await um<{ c: number }>(`select count(*) c from fornecedores f ${juncaoFts} where ${onde}`, par))?.c ?? 0
  const linhas = await todos<{
    id: number; razao_social: string; nome_fantasia: string; cnpj: string; cidade: string; uf: string
    cond_pagamento: string; prazo_entrega_dias: number; avaliacao: number; homologado: number
    grupos: number; propostas: number
  }>(
    `select f.id, f.razao_social, f.nome_fantasia, f.cnpj, f.cidade, f.uf, f.cond_pagamento,
            f.prazo_entrega_dias, f.avaliacao, f.homologado,
            (select count(*) from fornecedor_grupos where fornecedor_id = f.id) grupos,
            (select count(*) from propostas where fornecedor_id = f.id) propostas
       from fornecedores f ${juncaoFts}
      where ${onde} order by f.razao_social limit ? offset ?`,
    [...par, POR_PAGINA, (pagina - 1) * POR_PAGINA])
  const ms = Number(process.hrtime.bigint() - inicio) / 1e6
  const universo = (await um<{ c: number }>('select count(*) c from fornecedores'))?.c ?? 0
  const base = `/fornecedores?q=${encodeURIComponent(q)}&uf=${uf}&grupo=${grupo}&situacao=${situacao}`

  return (
    <>
      <CabecalhoPagina
        icone={<IconeFabrica size={19} />}
        titulo="Fornecedores"
        descricao="Cadastro com homologação, grupos de fornecimento habilitados e histórico de participação em cotações."
        acoes={<TempoConsulta ms={ms} registros={universo} />}
      />

      <Filtros acao="/fornecedores" busca={q}
        placeholder="Buscar por razão social, nome fantasia, CNPJ ou cidade…"
        selects={[
          { nome: 'grupo', valor: grupo, vazio: 'Todos os grupos', rotulo: 'Grupo',
            opcoes: grupos.map((g) => ({ valor: String(g.id), rotulo: g.nome })) },
          { nome: 'uf', valor: uf, vazio: 'Todas as UFs', rotulo: 'UF',
            opcoes: ufs.map((u) => ({ valor: u.uf, rotulo: u.uf })) },
          { nome: 'situacao', valor: situacao, vazio: 'Todas as situações', rotulo: 'Situação', opcoes: [
            { valor: 'homologado', rotulo: 'Homologados' }, { valor: 'pendente', rotulo: 'Não homologados' }] },
        ]} />

      <Painel semPadding>
        {linhas.length === 0 ? (
          <Vazio icone={<IconeBusca size={20} />} titulo="Nenhum fornecedor encontrado"
            descricao="Ajuste a busca ou remova algum filtro para ampliar o resultado."
            acao={<Link href="/fornecedores" className="btn btn-secundario btn-sm">Limpar filtros</Link>} />
        ) : (
          <>
            <div className="rolagem-x">
              <table className="tabela tabela-cartoes">
                <thead>
                  <tr>
                    <th>Razão social</th><th>CNPJ</th><th>Praça</th>
                    <th className="num">Grupos</th><th>Condição padrão</th>
                    <th className="num">Propostas</th><th className="num">Avaliação</th><th>Homologação</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((f) => (
                    <tr key={f.id}>
                      <td data-p>
                        <Link href={`/fornecedores/${f.id}`}
                              className="text-sm text-ink-900 hover:text-petrol-700 font-medium md:font-normal transition-colors">
                          {f.razao_social}
                        </Link>
                        <span className="block text-2xs text-ink-500 mt-0.5">{f.nome_fantasia}</span>
                      </td>
                      <td data-r="CNPJ" className="texto-mono text-xs text-ink-600 whitespace-nowrap">{f.cnpj}</td>
                      <td data-r="Praça" className="text-sm text-ink-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <IconeLocal size={13} className="text-ink-400 hidden md:inline" />
                          {f.cidade}/{f.uf}
                        </span>
                      </td>
                      <td data-r="Grupos" className="num text-sm">{f.grupos}</td>
                      <td data-r="Condição" className="text-xs text-ink-600 whitespace-nowrap">
                        {f.cond_pagamento} · {f.prazo_entrega_dias}d
                      </td>
                      <td data-r="Propostas" className="num text-sm">{f.propostas || '—'}</td>
                      <td data-r="Avaliação" className="num text-sm">
                        <span className="inline-flex items-center gap-1 tabular">
                          <IconeEstrela size={12} className="text-caution-600" />{dec(f.avaliacao, 1)}
                        </span>
                      </td>
                      <td data-r="Homologação">
                        <Tag variante={f.homologado ? 'positiva' : 'atencao'} ponto>
                          {f.homologado ? 'Homologado' : 'Pendente'}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao base={base} pagina={pagina} porPagina={POR_PAGINA} total={total} />
          </>
        )}
      </Painel>

      <div className="mt-4">
        <Aviso icone={<IconeInfo size={16} />}>
          Cada fornecedor está vinculado aos grupos de materiais que está apto a fornecer — é esse vínculo que
          determina, automaticamente, quem recebe cada cotação.
        </Aviso>
      </div>
    </>
  )
}
