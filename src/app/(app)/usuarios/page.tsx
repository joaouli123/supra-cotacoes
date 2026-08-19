import Link from 'next/link'
import { exigir } from '@/lib/acesso'
import { todos, um } from '@/lib/db'
import { numero, dataRelativa } from '@/lib/formato'
import { Painel, Paginacao, CabecalhoPagina, Vazio, Tag, Kpi, GradeKpis, Aviso } from '@/components/ui'
import { Filtros, TempoConsulta } from '@/components/Filtros'
import { BotaoNovo, AcoesLinha, Retorno, Recusa } from '@/components/Acoes'
import { REGISTROS } from '@/lib/registros'
import { lerRecado } from '@/lib/flash'
import { IconeUsuario, IconeBusca, IconeEscudo, IconePorta, IconeInfo } from '@/components/icones'

export const dynamic = 'force-dynamic'
const POR_PAGINA = 40
const SPEC = REGISTROS.usuarios

type VarianteTag = 'ativa' | 'positiva' | 'neutra' | 'atencao'
const PERFIS: Record<string, { rotulo: string; variante: VarianteTag }> = {
  admin_central: { rotulo: 'Administrador central', variante: 'ativa' },
  gestor: { rotulo: 'Gestor de suprimentos', variante: 'positiva' },
  comprador: { rotulo: 'Comprador', variante: 'neutra' },
  fornecedor: { rotulo: 'Portal do fornecedor', variante: 'atencao' },
}

export default async function PaginaUsuarios({ searchParams }: { searchParams: { [k: string]: string | undefined } }) {
  const s = await exigir('usuarios')
  const eid = s.empresa?.id ?? null
  const q = (searchParams.q ?? '').trim()
  const perfil = searchParams.perfil ?? ''
  const situacao = searchParams.situacao ?? 'ativos'
  const pagina = Math.max(1, Number(searchParams.pagina ?? 1))

  const cond: string[] = ['1=1']
  const par: Array<string | number> = []
  if (eid) { cond.push('u.empresa_id = ?'); par.push(eid) }
  if (q) { cond.push('(u.nome like ? or u.email like ? or u.cargo like ?)'); par.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  if (perfil) { cond.push('u.perfil = ?'); par.push(perfil) }
  if (situacao === 'ativos') cond.push('u.ativo = 1')
  if (situacao === 'inativos') cond.push('u.ativo = 0')
  const onde = cond.join(' and ')

  const inicio = process.hrtime.bigint()
  const total = (await um<{ c: number }>(`select count(*) c from usuarios u where ${onde}`, par))?.c ?? 0
  const linhas = await todos<{
    id: number; nome: string; email: string; cargo: string; perfil: string; telefone: string
    ativo: number; ultimo_acesso: string | null; empresa: string | null; fornecedor: string | null
    demandas: number
  }>(
    `select u.id, u.nome, u.email, u.cargo, u.perfil, u.telefone, u.ativo, u.ultimo_acesso,
            e.nome_fantasia as empresa, f.nome_fantasia as fornecedor,
            (select count(*) from demandas d where d.solicitante = u.nome) demandas
       from usuarios u
       left join empresas e on e.id = u.empresa_id
       left join fornecedores f on f.id = u.fornecedor_id
      where ${onde} order by u.ativo desc, u.nome limit ? offset ?`,
    [...par, POR_PAGINA, (pagina - 1) * POR_PAGINA])
  const ms = Number(process.hrtime.bigint() - inicio) / 1e6

  const universo = (await um<{ c: number }>('select count(*) c from usuarios'))?.c ?? 0
  const semAcesso = (await um<{ c: number }>(
    `select count(*) c from usuarios u where ${onde} and u.ultimo_acesso is null`, par))?.c ?? 0
  const doPortal = (await um<{ c: number }>(
    `select count(*) c from usuarios u where ${onde} and u.perfil = 'fornecedor'`, par))?.c ?? 0

  const base = `/usuarios?q=${encodeURIComponent(q)}&perfil=${perfil}&situacao=${situacao}`
  const aqui = `${base}&pagina=${pagina}`

  return (
    <>
      <CabecalhoPagina
        icone={<IconeUsuario size={19} />}
        titulo="Usuários e acessos"
        descricao="Quem entra na plataforma, com que perfil e sobre qual empresa. O perfil determina as áreas visíveis e o que cada pessoa pode gravar."
        acoes={<><TempoConsulta ms={ms} registros={universo} /><BotaoNovo spec={SPEC} /></>} />

      <Retorno ok={searchParams.ok} />
      <Recusa mensagem={lerRecado(searchParams.f)?.erros._} />

      <GradeKpis>
        <Kpi icone={<IconeUsuario size={14} />} rotulo="Usuários no filtro" valor={numero(total)}
             apoio={`${numero(universo)} cadastrados na plataforma`} />
        <Kpi icone={<IconeEscudo size={14} />} rotulo="Perfis internos" valor={numero(total - doPortal)}
             apoio="gestores, compradores e administração" />
        <Kpi icone={<IconePorta size={14} />} rotulo="Portal do fornecedor" valor={numero(doPortal)}
             apoio="acesso restrito às próprias propostas" />
        <Kpi icone={<IconeInfo size={14} />} rotulo="Nunca acessaram" valor={numero(semAcesso)}
             tom={semAcesso > 0 ? 'atencao' : undefined} apoio="convites pendentes de primeiro login" />
      </GradeKpis>

      <div className="mt-4 sm:mt-5">
        <Filtros acao="/usuarios" busca={q} placeholder="Buscar por nome, e-mail ou cargo…"
          selects={[
            { nome: 'perfil', valor: perfil, vazio: 'Todos os perfis', rotulo: 'Perfil',
              opcoes: Object.entries(PERFIS).map(([v, p]) => ({ valor: v, rotulo: p.rotulo })) },
            { nome: 'situacao', valor: situacao, vazio: 'Todas as situações', rotulo: 'Situação', opcoes: [
              { valor: 'ativos', rotulo: 'Somente ativos' }, { valor: 'inativos', rotulo: 'Somente inativos' }] },
          ]} />
      </div>

      <Painel semPadding>
        {linhas.length === 0 ? (
          <Vazio icone={<IconeBusca size={20} />} titulo="Nenhum usuário encontrado"
            descricao="Ajuste a busca ou cadastre um novo acesso."
            acao={<div className="flex flex-wrap justify-center gap-2">
              <Link href="/usuarios" className="btn btn-secundario btn-sm">Limpar filtros</Link>
              <BotaoNovo spec={SPEC} />
            </div>} />
        ) : (
          <>
            <div className="rolagem-x">
              <table className="tabela tabela-cartoes">
                <thead><tr>
                  <th>Usuário</th><th>Cargo</th><th>Perfil</th><th>Vínculo</th>
                  <th className="num">Demandas</th><th>Último acesso</th>
                  <th className="w-px"><span className="sr-only">Ações</span></th>
                </tr></thead>
                <tbody>
                  {linhas.map((u) => {
                    const p = PERFIS[u.perfil] ?? { rotulo: u.perfil, variante: 'neutra' as VarianteTag }
                    return (
                      <tr key={u.id}>
                        <td data-p>
                          <span className="block text-sm text-ink-900 font-medium md:font-normal">{u.nome}</span>
                          <span className="block text-2xs text-ink-500 mt-0.5 truncate max-w-[220px]">{u.email}</span>
                        </td>
                        <td data-r="Cargo" className="text-xs text-ink-600 whitespace-nowrap">{u.cargo}</td>
                        <td data-r="Perfil"><Tag variante={p.variante}>{p.rotulo}</Tag></td>
                        <td data-r="Vínculo" className="text-xs text-ink-500 whitespace-nowrap">
                          {u.fornecedor ?? u.empresa ?? 'Plataforma'}
                        </td>
                        <td data-r="Demandas" className="num text-sm">{u.demandas || '—'}</td>
                        <td data-r="Último acesso" className="text-xs text-ink-500 whitespace-nowrap">
                          {u.ativo === 0
                            ? <Tag variante="neutra">Inativo</Tag>
                            : u.ultimo_acesso
                              ? dataRelativa(u.ultimo_acesso)
                              : <span className="text-caution-700">nunca entrou</span>}
                        </td>
                        <td data-a>
                          <AcoesLinha spec={SPEC} id={u.id} ativo={u.ativo} rotulo={u.nome} voltar={aqui} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Paginacao base={base} pagina={pagina} porPagina={POR_PAGINA} total={total} />
          </>
        )}
      </Painel>

      <div className="mt-4">
        <Aviso icone={<IconeEscudo size={16} />}>
          A senha nunca é guardada em texto: fica um derivado <span className="texto-mono text-xs">scrypt</span> com
          sal próprio por usuário. Ao editar, deixar o campo em branco mantém a senha atual — e a troca fica
          registrada na auditoria sem revelar o valor.
        </Aviso>
      </div>
    </>
  )
}
