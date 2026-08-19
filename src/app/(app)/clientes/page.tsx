import Link from 'next/link'
import { exigir } from '@/lib/acesso'
import { todos, um } from '@/lib/db'
import { Painel, Paginacao, CabecalhoPagina, Vazio, Tag, Aviso } from '@/components/ui'
import { Filtros, TempoConsulta } from '@/components/Filtros'
import { BotaoNovo, AcoesLinha, Retorno, Recusa } from '@/components/Acoes'
import { REGISTROS } from '@/lib/registros'
import { lerRecado } from '@/lib/flash'
import { IconePessoas, IconeBusca, IconeEscudo, IconeLocal } from '@/components/icones'

const SPEC = REGISTROS.clientes

export const dynamic = 'force-dynamic'
const POR_PAGINA = 40

export default async function PaginaClientes({ searchParams }: { searchParams: { [k: string]: string | undefined } }) {
  const s = await exigir('cadastros')
  const eid = s.empresa?.id ?? null
  const q = (searchParams.q ?? '').trim()
  const segmento = searchParams.segmento ?? ''
  const uf = searchParams.uf ?? ''
  const situacao = searchParams.situacao ?? 'ativos'
  const pagina = Math.max(1, Number(searchParams.pagina ?? 1))

  const segmentos = await todos<{ segmento: string }>('select distinct segmento from clientes order by segmento')
  const ufs = await todos<{ uf: string }>('select distinct uf from clientes order by uf')

  const cond: string[] = ['1=1']
  const par: Array<string | number> = []
  if (eid) { cond.push('c.empresa_id = ?'); par.push(eid) }
  if (q) { cond.push('(c.razao_social like ? or c.nome_fantasia like ? or c.cnpj like ?)'); par.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  if (segmento) { cond.push('c.segmento = ?'); par.push(segmento) }
  if (uf) { cond.push('c.uf = ?'); par.push(uf) }
  if (situacao === 'ativos') cond.push('c.ativo = 1')
  if (situacao === 'inativos') cond.push('c.ativo = 0')
  const onde = cond.join(' and ')

  const inicio = process.hrtime.bigint()
  const total = (await um<{ c: number }>(`select count(*) c from clientes c where ${onde}`, par))?.c ?? 0
  const linhas = await todos<{
    id: number; razao_social: string; nome_fantasia: string; cnpj: string; contato: string
    email: string; telefone: string; cidade: string; uf: string; segmento: string
    ativo: number; alteracoes: number
  }>(
    `select c.*, (select count(*) from auditoria a where a.entidade='clientes' and a.entidade_id=c.id) alteracoes
       from clientes c where ${onde} order by c.razao_social limit ? offset ?`,
    [...par, POR_PAGINA, (pagina - 1) * POR_PAGINA])
  const ms = Number(process.hrtime.bigint() - inicio) / 1e6
  const universo = (await um<{ c: number }>('select count(*) c from clientes'))?.c ?? 0
  const base = `/clientes?q=${encodeURIComponent(q)}&segmento=${encodeURIComponent(segmento)}&uf=${uf}&situacao=${situacao}`
  const aqui = `${base}&pagina=${pagina}`

  return (
    <>
      <CabecalhoPagina
        icone={<IconePessoas size={19} />}
        titulo="Clientes"
        descricao="Cadastro exclusivo de cada empresa — sem compartilhamento entre os inquilinos da plataforma."
        acoes={<><TempoConsulta ms={ms} registros={universo} /><BotaoNovo spec={SPEC} /></>} />

      <Retorno ok={searchParams.ok} />
      <Recusa mensagem={lerRecado(searchParams.f)?.erros._} />

      <Filtros acao="/clientes" busca={q} placeholder="Buscar por razão social, nome fantasia ou CNPJ…"
        selects={[
          { nome: 'segmento', valor: segmento, vazio: 'Todos os segmentos', rotulo: 'Segmento',
            opcoes: segmentos.map((x) => ({ valor: x.segmento, rotulo: x.segmento })) },
          { nome: 'uf', valor: uf, vazio: 'Todas as UFs', rotulo: 'UF',
            opcoes: ufs.map((x) => ({ valor: x.uf, rotulo: x.uf })) },
          { nome: 'situacao', valor: situacao, vazio: 'Todas as situações', rotulo: 'Situação',
            opcoes: [{ valor: 'ativos', rotulo: 'Somente ativos' }, { valor: 'inativos', rotulo: 'Somente inativos' }] },
        ]} />

      <Painel semPadding>
        {linhas.length === 0 ? (
          <Vazio icone={<IconeBusca size={20} />} titulo="Nenhum cliente encontrado"
            descricao="Ajuste a busca ou remova algum filtro."
            acao={<div className="flex gap-2">
              <Link href="/clientes" className="btn btn-secundario btn-sm">Limpar filtros</Link>
              <BotaoNovo spec={SPEC} />
            </div>} />
        ) : (
          <>
            <div className="rolagem-x">
              <table className="tabela tabela-cartoes">
                <thead><tr>
                  <th>Razão social</th><th>CNPJ</th><th>Contato</th><th>Praça</th>
                  <th>Segmento</th><th className="num">Alterações</th><th>Situação</th>
                  <th className="w-px"><span className="sr-only">Ações</span></th>
                </tr></thead>
                <tbody>
                  {linhas.map((c) => (
                    <tr key={c.id}>
                      <td data-p>
                        <span className="text-sm text-ink-900 font-medium md:font-normal">{c.razao_social}</span>
                        <span className="block text-2xs text-ink-500 mt-0.5">{c.nome_fantasia}</span>
                      </td>
                      <td data-r="CNPJ" className="texto-mono text-xs text-ink-600 whitespace-nowrap">{c.cnpj}</td>
                      <td data-r="Contato">
                        <span className="text-sm text-ink-700">{c.contato}</span>
                        <span className="block text-2xs text-ink-400 truncate max-w-[190px]">{c.email}</span>
                      </td>
                      <td data-r="Praça" className="text-sm text-ink-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <IconeLocal size={13} className="text-ink-400 hidden md:inline" />{c.cidade}/{c.uf}
                        </span>
                      </td>
                      <td data-r="Segmento" className="text-xs text-ink-600">{c.segmento}</td>
                      <td data-r="Alterações" className="num text-sm">{c.alteracoes || '—'}</td>
                      <td data-r="Situação">
                        <Tag variante={c.ativo ? 'positiva' : 'neutra'} ponto>{c.ativo ? 'Ativo' : 'Inativo'}</Tag>
                      </td>
                      <td data-a>
                        <AcoesLinha spec={SPEC} id={c.id} ativo={c.ativo} rotulo={c.razao_social} voltar={aqui} />
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
        <Aviso icone={<IconeEscudo size={16} />}>
          A coluna <strong className="font-medium text-ink-800">Alterações</strong> reflete a trilha de auditoria
          exigida para clientes e fornecedores: toda mudança de campo fica registrada com autor, data e IP.
        </Aviso>
      </div>
    </>
  )
}
