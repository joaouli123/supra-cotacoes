import { todos, um } from '@/lib/db'
import { exigir } from '@/lib/acesso'
import { numero, percentual, data, iniciais } from '@/lib/formato'
import { Painel, CabecalhoPagina, Tag, Kpi, GradeKpis, Vazio, Barra, Aviso } from '@/components/ui'
import { IconePredio, IconeUsuario, IconeBalanca, IconeCaixa, IconeCadeado, IconeLocal } from '@/components/icones'

export const dynamic = 'force-dynamic'

export default async function PaginaEmpresas() {
  const s = await exigir('admin')

  const linhas = await todos<{
    id: number; razao_social: string; nome_fantasia: string; cnpj: string; cidade: string; uf: string
    segmento: string; plano: string; criado_em: string
    usuarios: number; compradores: number; cotacoes: number; materiais: number
    clientes: number; conectores: number
  }>(
    `select e.*,
       (select count(*) from usuarios u where u.empresa_id = e.id) usuarios,
       (select count(*) from usuarios u where u.empresa_id = e.id and u.perfil='comprador') compradores,
       (select count(*) from cotacoes c where c.empresa_id = e.id) cotacoes,
       (select count(*) from materiais m where m.empresa_id = e.id) materiais,
       (select count(*) from clientes cl where cl.empresa_id = e.id) clientes,
       (select count(*) from erp_conectores k where k.empresa_id = e.id) conectores
     from empresas e where e.ativo = 1 order by e.nome_fantasia`)

  const corporativos = (await um<{ c: number }>('select count(*) c from materiais where empresa_id is null'))?.c ?? 0
  const totalUsuarios = (await um<{ c: number }>('select count(*) c from usuarios'))?.c ?? 0
  const totalCotacoes = (await um<{ c: number }>('select count(*) c from cotacoes'))?.c ?? 0
  const maxCotacoes = Math.max(1, ...linhas.map((l) => l.cotacoes))

  return (
    <>
      <CabecalhoPagina icone={<IconePredio size={19} />} titulo="Empresas na plataforma"
        descricao="Visão do administrador central: cada empresa é um inquilino isolado, com seus usuários, cadastros próprios e conectores de ERP." />

      <GradeKpis>
        <Kpi icone={<IconePredio size={14} />} rotulo="Empresas ativas" valor={numero(linhas.length)} apoio="inquilinos da plataforma" />
        <Kpi icone={<IconeUsuario size={14} />} rotulo="Usuários totais" valor={numero(totalUsuarios)} apoio="internos e do portal do fornecedor" />
        <Kpi icone={<IconeBalanca size={14} />} rotulo="Cotações conduzidas" valor={numero(totalCotacoes)} apoio="somando todas as empresas" />
        <Kpi icone={<IconeCaixa size={14} />} rotulo="Catálogo corporativo" valor={numero(corporativos)} apoio="materiais compartilhados entre todas" />
      </GradeKpis>

      <div className="mt-5">
        <Painel semPadding icone={<IconePredio size={15} />} titulo="Inquilinos">
          {linhas.length === 0 ? <Vazio titulo="Nenhuma empresa" /> : (
            <div className="rolagem-x">
              <table className="tabela tabela-cartoes">
                <thead><tr>
                  <th>Empresa</th><th>CNPJ</th><th>Segmento</th><th>Praça</th><th>Plano</th>
                  <th className="num">Usuários</th><th className="num">Materiais próprios</th>
                  <th className="num">Clientes</th><th className="num">ERPs</th><th>Cotações</th><th></th>
                </tr></thead>
                <tbody>
                  {linhas.map((e) => (
                    <tr key={e.id} className={e.id === s.empresa?.id ? 'bg-petrol-100/30' : ''}>
                      <td data-p>
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded bg-ink-100 text-ink-600 grid place-items-center text-[9px] font-bold shrink-0">
                            {iniciais(e.nome_fantasia)}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm text-ink-900 truncate">{e.nome_fantasia}</span>
                            <span className="block text-2xs text-ink-400 truncate max-w-[200px]">{e.razao_social}</span>
                          </span>
                        </div>
                      </td>
                      <td data-r="CNPJ" className="texto-mono text-xs text-ink-600 whitespace-nowrap">{e.cnpj}</td>
                      <td data-r="Segmento" className="text-xs text-ink-600 whitespace-nowrap">{e.segmento}</td>
                      <td data-r="Praça" className="text-xs text-ink-600 whitespace-nowrap">{e.cidade}/{e.uf}</td>
                      <td data-r="Plano"><Tag variante={e.plano === 'Corporativo' ? 'ativa' : 'neutra'}>{e.plano}</Tag></td>
                      <td data-r="Usuários" className="num text-sm">{numero(e.usuarios)}
                        <span className="block text-2xs text-ink-400">{e.compradores} compradores</span></td>
                      <td data-r="Materiais próprios" className="num text-sm">{numero(e.materiais)}</td>
                      <td data-r="Clientes" className="num text-sm">{numero(e.clientes)}</td>
                      <td data-r="ERPs" className="num text-sm">{e.conectores || '—'}</td>
                      <td data-r="Cotações" className="md:min-w-[110px]">
                        <div className="flex items-center gap-2 justify-end md:justify-start">
                          <span className="text-sm tabular md:w-7">{e.cotacoes}</span>
                          <span className="flex-1 max-w-[60px]"><Barra valor={e.cotacoes / maxCotacoes} cor="bg-ink-900" /></span>
                        </div>
                      </td>
                      <td data-a className="text-right">
                        {e.id === s.empresa?.id
                          ? <Tag variante="ativa">Contexto atual</Tag>
                          : <a href={`/api/contexto?empresa=${e.id}&voltar=/painel`} className="btn btn-secundario btn-sm">Entrar</a>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Painel>
      </div>

      <div className="painel p-4 sm:p-5 mt-4 sm:mt-5">
        <h2 className="text-sm font-semibold text-ink-900 flex items-center gap-2"><span className="text-ink-400"><IconeCadeado size={15} /></span>Como o isolamento é garantido</h2>
        <div className="grid md:grid-cols-3 gap-5 mt-4 text-sm text-ink-600">
          <div>
            <p className="font-medium text-ink-900 text-xs uppercase tracking-wider mb-1.5">Dados transacionais</p>
            <p>Cotações, demandas, propostas e auditoria carregam <span className="texto-mono text-xs">empresa_id</span> obrigatório.
               Nenhuma consulta da aplicação é emitida sem o predicado de empresa.</p>
          </div>
          <div>
            <p className="font-medium text-ink-900 text-xs uppercase tracking-wider mb-1.5">Catálogo compartilhado</p>
            <p>Materiais, fornecedores e transportadoras aceitam <span className="texto-mono text-xs">empresa_id</span> nulo,
               formando um catálogo corporativo comum — sem duplicar {numero(corporativos)} itens por empresa.</p>
          </div>
          <div>
            <p className="font-medium text-ink-900 text-xs uppercase tracking-wider mb-1.5">Cadastros exclusivos</p>
            <p>Clientes nunca são compartilhados: são sempre privativos da empresa proprietária,
               por serem a informação comercialmente mais sensível.</p>
          </div>
        </div>
      </div>
    </>
  )
}
