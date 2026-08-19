import Link from 'next/link'
import { exigir } from '@/lib/acesso'
import { todos, um } from '@/lib/db'
import { numero, dataHora } from '@/lib/formato'
import { Painel, Paginacao, CabecalhoPagina, Vazio, Tag, Kpi, GradeKpis, Aviso } from '@/components/ui'
import { Filtros } from '@/components/Filtros'
import {
  IconeEscudo, IconeBusca, IconeCadeado, IconeFabrica, IconePessoas, IconeUsuario, IconeLocal,
} from '@/components/icones'

export const dynamic = 'force-dynamic'
const POR_PAGINA = 40

export default async function PaginaAuditoria({ searchParams }: { searchParams: { [k: string]: string | undefined } }) {
  const s = await exigir('auditoria')
  const eid = s.empresa?.id ?? null
  const q = (searchParams.q ?? '').trim()
  const entidade = searchParams.entidade ?? ''
  const operacao = searchParams.operacao ?? ''
  const pagina = Math.max(1, Number(searchParams.pagina ?? 1))

  const cond: string[] = ['1=1']
  const par: Array<string | number> = []
  if (eid) { cond.push('a.empresa_id = ?'); par.push(eid) }
  if (q) { cond.push('(a.entidade_rotulo like ? or a.usuario_nome like ? or a.campo like ?)'); par.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  if (entidade) { cond.push('a.entidade = ?'); par.push(entidade) }
  if (operacao) { cond.push('a.operacao = ?'); par.push(operacao) }
  const onde = cond.join(' and ')

  const total = (await um<{ c: number }>(`select count(*) c from auditoria a where ${onde}`, par))?.c ?? 0
  const linhas = await todos<{
    id: number; entidade: string; entidade_id: number; entidade_rotulo: string; campo: string
    valor_anterior: string | null; valor_novo: string | null; operacao: string
    usuario_nome: string; ip: string; criado_em: string
  }>(`select a.* from auditoria a where ${onde} order by a.criado_em desc limit ? offset ?`,
     [...par, POR_PAGINA, (pagina - 1) * POR_PAGINA])

  const porEntidade = await todos<{ entidade: string; c: number }>(
    `select entidade, count(*) c from auditoria a ${eid ? 'where empresa_id = ?' : ''} group by entidade`, eid ? [eid] : [])
  const usuariosDistintos = (await um<{ c: number }>(
    `select count(distinct usuario_id) c from auditoria a ${eid ? 'where empresa_id = ?' : ''}`, eid ? [eid] : []))?.c ?? 0
  const totalGeral = (await um<{ c: number }>(
    `select count(*) c from auditoria a ${eid ? 'where empresa_id = ?' : ''}`, eid ? [eid] : []))?.c ?? 0
  const nEnt = (e: string) => porEntidade.find((x) => x.entidade === e)?.c ?? 0

  return (
    <>
      <CabecalhoPagina
        icone={<IconeEscudo size={19} />}
        titulo="Trilha de auditoria"
        descricao="Registro imutável de alterações em cadastros sensíveis — clientes e fornecedores — com autor, campo, valores antes e depois, data e endereço de origem." />

      <GradeKpis>
        <Kpi icone={<IconeCadeado size={14} />} rotulo="Lançamentos" valor={numero(totalGeral)} apoio="no período retido" />
        <Kpi icone={<IconeFabrica size={14} />} rotulo="Em fornecedores" valor={numero(nEnt('fornecedores'))} apoio="alterações rastreadas" />
        <Kpi icone={<IconePessoas size={14} />} rotulo="Em clientes" valor={numero(nEnt('clientes'))} apoio="alterações rastreadas" />
        <Kpi icone={<IconeUsuario size={14} />} rotulo="Usuários auditados" valor={numero(usuariosDistintos)} apoio="autores distintos" />
      </GradeKpis>

      <div className="mt-5">
        <Filtros acao="/auditoria" busca={q} placeholder="Buscar por registro, usuário ou campo…"
          selects={[
            { nome: 'entidade', valor: entidade, vazio: 'Todas as entidades', rotulo: 'Entidade', opcoes: [
              { valor: 'fornecedores', rotulo: 'Fornecedores' }, { valor: 'clientes', rotulo: 'Clientes' }] },
            { nome: 'operacao', valor: operacao, vazio: 'Todas as operações', rotulo: 'Operação', opcoes: [
              { valor: 'alteracao', rotulo: 'Alteração' }, { valor: 'inclusao', rotulo: 'Inclusão' },
              { valor: 'inativacao', rotulo: 'Inativação' }] },
          ]} />
      </div>

      <Painel semPadding>
        {linhas.length === 0 ? (
          <Vazio icone={<IconeBusca size={20} />} titulo="Nenhum registro de auditoria"
            descricao="Ajuste a busca ou remova algum filtro."
            acao={<Link href="/auditoria" className="btn btn-secundario btn-sm">Limpar filtros</Link>} />
        ) : (
          <>
            <div className="rolagem-x">
              <table className="tabela tabela-cartoes">
                <thead><tr>
                  <th>Registro</th><th>Data e hora</th><th>Campo</th>
                  <th>Valor anterior</th><th>Valor novo</th><th>Autor</th><th>Origem</th>
                </tr></thead>
                <tbody>
                  {linhas.map((a) => (
                    <tr key={a.id}>
                      <td data-p>
                        <span className="text-sm text-ink-900 md:max-w-[210px] md:truncate block font-medium md:font-normal">
                          {a.entidade_rotulo}
                        </span>
                        <span className="mt-1 inline-block">
                          <Tag variante={a.entidade === 'fornecedores' ? 'ativa' : 'neutra'}
                               icone={a.entidade === 'fornecedores' ? <IconeFabrica size={11} /> : <IconePessoas size={11} />}>
                            {a.entidade === 'fornecedores' ? 'Fornecedor' : 'Cliente'}
                          </Tag>
                        </span>
                      </td>
                      <td data-r="Data e hora" className="text-xs text-ink-600 whitespace-nowrap">{dataHora(a.criado_em)}</td>
                      <td data-r="Campo">
                        {a.operacao === 'alteracao'
                          ? <span className="texto-mono text-xs bg-ink-100 px-1.5 py-0.5 rounded text-ink-700">{a.campo}</span>
                          : <Tag variante={a.operacao === 'inclusao' ? 'positiva' : 'critica'}>
                              {a.operacao === 'inclusao' ? 'Inclusão' : 'Inativação'}
                            </Tag>}
                      </td>
                      <td data-r="Valor anterior" className="text-xs text-ink-500 md:max-w-[160px] md:truncate">
                        {a.valor_anterior ? <span className="line-through">{a.valor_anterior}</span> : '—'}
                      </td>
                      <td data-r="Valor novo" className="text-xs text-ink-900 md:max-w-[160px] md:truncate font-medium">
                        {a.valor_novo ?? '—'}
                      </td>
                      <td data-r="Autor" className="text-sm text-ink-700 whitespace-nowrap">
                        {a.usuario_nome.split(' ').slice(0, 2).join(' ')}
                      </td>
                      <td data-r="Origem" className="texto-mono text-2xs text-ink-400 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <IconeLocal size={11} className="hidden md:inline" />{a.ip}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao base={`/auditoria?q=${encodeURIComponent(q)}&entidade=${entidade}&operacao=${operacao}`}
              pagina={pagina} porPagina={POR_PAGINA} total={total} />
          </>
        )}
      </Painel>

      <div className="mt-4">
        <Aviso icone={<IconeCadeado size={16} />}>
          A trilha é somente-inclusão: registros de auditoria não são editáveis nem removíveis pela aplicação.
          O escopo segue o levantamento — auditoria obrigatória em clientes e fornecedores — e pode ser
          estendido a qualquer outra entidade sem mudança de modelo.
        </Aviso>
      </div>
    </>
  )
}
