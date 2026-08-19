import Link from 'next/link'
import { exigir } from '@/lib/acesso'
import { filtroEmpresa } from '@/lib/sessao'
import { todos, um, buscaTextual } from '@/lib/db'
import { moeda, numero } from '@/lib/formato'
import { Painel, Paginacao, CabecalhoPagina, Vazio, Tag, Aviso } from '@/components/ui'
import { Filtros, TempoConsulta } from '@/components/Filtros'
import { BotaoNovo, AcoesLinha, Retorno, Recusa } from '@/components/Acoes'
import { REGISTROS } from '@/lib/registros'
import { lerRecado } from '@/lib/flash'
import { IconeCaixa, IconeBusca, IconeCamada, IconeInfo } from '@/components/icones'

export const dynamic = 'force-dynamic'
const POR_PAGINA = 40
const SPEC = REGISTROS.materiais

export default async function PaginaMateriais({ searchParams }: { searchParams: { [k: string]: string | undefined } }) {
  const s = await exigir('cadastros')
  const eid = s.empresa?.id ?? null
  const q = (searchParams.q ?? '').trim()
  const grupo = searchParams.grupo ?? ''
  const curva = searchParams.curva ?? ''
  const situacao = searchParams.situacao ?? 'ativos'
  const pagina = Math.max(1, Number(searchParams.pagina ?? 1))

  const grupos = await todos<{ id: number; nome: string }>(
    'select id, nome from classificacoes where nivel = 1 order by nome')

  const cond: string[] = [situacao === 'inativos' ? 'm.ativo = 0' : 'm.ativo = 1']
  const par: Array<string | number | null> = []
  const fe = filtroEmpresa(eid, 'm')
  cond.push(fe.sql); par.push(...fe.params)

  // A busca textual muda de dialeto conforme o motor (FTS5 ou tsvector)
  const busca = buscaTextual('materiais', 'm', q)
  const juncaoFts = busca.juncao
  if (busca.condicao) { cond.push(busca.condicao); par.push(...busca.params) }
  if (grupo) {
    cond.push('m.classificacao_id in (select id from classificacoes where nivel = 5 and caminho like ?)')
    par.push(`${grupo} ›%`)
  }
  if (curva) { cond.push('m.curva = ?'); par.push(curva) }

  const onde = cond.join(' and ')
  const inicio = process.hrtime.bigint()

  const total = (await um<{ c: number }>(
    `select count(*) c from materiais m ${juncaoFts} where ${onde}`, par))?.c ?? 0

  const linhas = await todos<{
    id: number; codigo: string; descricao: string; unidade: string; caminho: string
    preco_referencia: number; curva: string; ncm: string; ativo: number
    empresa_id: number | null; empresa: string | null
  }>(
    `select m.id, m.codigo, m.descricao, un.sigla as unidade, cl.caminho,
            m.preco_referencia, m.curva, m.ncm, m.ativo, m.empresa_id, e.nome_fantasia as empresa
       from materiais m ${juncaoFts}
       join unidades un on un.id = m.unidade_id
       join classificacoes cl on cl.id = m.classificacao_id
       left join empresas e on e.id = m.empresa_id
      where ${onde} order by m.codigo limit ? offset ?`,
    [...par, POR_PAGINA, (pagina - 1) * POR_PAGINA])

  const ms = Number(process.hrtime.bigint() - inicio) / 1e6
  const universo = (await um<{ c: number }>('select count(*) c from materiais'))?.c ?? 0
  const base = `/materiais?q=${encodeURIComponent(q)}&grupo=${encodeURIComponent(grupo)}&curva=${curva}&situacao=${situacao}`
  const aqui = `${base}&pagina=${pagina}`

  return (
    <>
      <CabecalhoPagina
        icone={<IconeCaixa size={19} />}
        titulo="Materiais"
        descricao="Catálogo corporativo compartilhado e itens exclusivos de cada empresa, classificados em cinco níveis."
        acoes={<><TempoConsulta ms={ms} registros={universo} /><BotaoNovo spec={SPEC} /></>}
      />

      <Retorno ok={searchParams.ok} />
      <Recusa mensagem={lerRecado(searchParams.f)?.erros._} />

      <Filtros
        acao="/materiais" busca={q}
        placeholder="Buscar por código, descrição ou especificação…"
        selects={[
          { nome: 'grupo', valor: grupo, vazio: 'Todos os grupos', rotulo: 'Grupo',
            opcoes: grupos.map((g) => ({ valor: g.nome, rotulo: g.nome })) },
          { nome: 'curva', valor: curva, vazio: 'Todas as curvas', rotulo: 'Curva', opcoes: [
            { valor: 'A', rotulo: 'Curva A — alto valor' },
            { valor: 'B', rotulo: 'Curva B — valor médio' },
            { valor: 'C', rotulo: 'Curva C — baixo valor' }] },
          { nome: 'situacao', valor: situacao, vazio: 'Todas as situações', rotulo: 'Situação', opcoes: [
            { valor: 'ativos', rotulo: 'Somente ativos' }, { valor: 'inativos', rotulo: 'Somente inativos' }] },
        ]}
      />

      <Painel semPadding>
        {linhas.length === 0 ? (
          <Vazio icone={<IconeBusca size={20} />}
            titulo="Nenhum material encontrado"
            descricao="Ajuste os termos da busca ou remova algum filtro para ampliar o resultado."
            acao={<div className="flex flex-wrap justify-center gap-2">
              <Link href="/materiais" className="btn btn-secundario btn-sm">Limpar filtros</Link>
              <BotaoNovo spec={SPEC} />
            </div>} />
        ) : (
          <>
            <div className="rolagem-x">
              <table className="tabela tabela-cartoes">
                <thead>
                  <tr>
                    <th>Código</th><th>Descrição</th><th>Classificação</th>
                    <th>Un.</th><th className="num">Preço ref.</th><th>Curva</th><th>Origem</th>
                    <th className="w-px"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((m) => (
                    <tr key={m.id}>
                      <td data-p>
                        <Link href={`/materiais/${m.id}`}
                              className="text-sm text-ink-900 hover:text-petrol-700 font-medium md:font-normal transition-colors">
                          {m.descricao}
                        </Link>
                        <span className="block texto-mono text-2xs text-ink-500 mt-0.5 md:hidden">{m.codigo}</span>
                      </td>
                      <td data-x data-r="Código" className="texto-mono text-xs text-ink-600 whitespace-nowrap">
                        {m.codigo}
                      </td>
                      <td data-r="Classificação" className="text-xs text-ink-500 md:max-w-[260px] md:truncate" title={m.caminho}>
                        <span className="hidden md:inline">{m.caminho}</span>
                        <span className="md:hidden text-right">{m.caminho.split(' › ')[0]}</span>
                      </td>
                      <td data-r="Unidade" className="text-xs text-ink-600 whitespace-nowrap">{m.unidade}</td>
                      <td data-r="Preço ref." className="num text-sm whitespace-nowrap font-medium">{moeda(m.preco_referencia)}</td>
                      <td data-r="Curva">
                        <Tag variante={m.curva === 'A' ? 'ativa' : 'neutra'}>{m.curva}</Tag>
                      </td>
                      <td data-r="Origem" className="text-xs text-ink-500 whitespace-nowrap">
                        {m.empresa_id === null ? 'Corporativo' : m.empresa}
                      </td>
                      <td data-a>
                        <AcoesLinha spec={SPEC} id={m.id} ativo={m.ativo} rotulo={m.descricao} voltar={aqui} />
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
          Busca full-text indexada (SQLite FTS5) sobre {numero(universo)} materiais. Os itens marcados como{' '}
          <strong className="font-medium text-ink-800">Corporativo</strong> integram o catálogo compartilhado
          entre todas as empresas; os demais são visíveis apenas pela empresa proprietária.
        </Aviso>
      </div>
    </>
  )
}
