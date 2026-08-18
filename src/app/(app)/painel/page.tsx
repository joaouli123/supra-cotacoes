import Link from 'next/link'
import { sessao, filtroEmpresa } from '@/lib/sessao'
import { todos, contar } from '@/lib/db'
import { economiaConsolidada } from '@/lib/consultas'
import { moeda, moedaCurta, numero, percentual, dataHora, dataRelativa, data } from '@/lib/formato'
import { Painel, Kpi, GradeKpis, StatusTag, Barra, CabecalhoPagina, Vazio, Tag } from '@/components/ui'
import {
  IconeSeta, IconePainel, IconeBalanca, IconeMoeda, IconeCamada, IconeCaixa,
  IconeRelogio, IconeConector, IconeGrafico, IconeQueda, IconeLista, IconeUsuario,
} from '@/components/icones'

export const dynamic = 'force-dynamic'

export default async function PaginaPainel() {
  const s = await sessao()
  const eid = s.empresa?.id ?? null
  const p = eid ? [eid] : []
  // Predicado de empresa sempre valido: sem empresa no contexto (administrador
  // da plataforma vendo tudo) vira "1=1", nunca uma clausula pela metade.
  const daEmpresa = eid ? 'empresa_id = ?' : '1=1'
  const fEmp = eid ? 'where empresa_id = ?' : ''

  const emAndamento = await contar(
    `select count(*) c from cotacoes where ${daEmpresa} and status in ('em_andamento','programada')`, p)
  const aguardando = await contar(
    `select count(*) c from cotacao_fornecedores cf join cotacoes c on c.id = cf.cotacao_id
      where cf.status in ('convidado','visualizado') and c.status = 'em_andamento' ${eid ? 'and c.empresa_id = ?' : ''}`, p)
  const demandasAbertas = await contar(
    `select count(*) c from demandas where ${daEmpresa} and status = 'aberta'`, p)

  const fm = filtroEmpresa(eid)
  const materiaisVisiveis = await contar(`select count(*) c from materiais where ativo = 1 and ${fm.sql}`, fm.params)
  const fornecedoresHomologados = await contar(
    `select count(*) c from fornecedores where homologado = 1 and ativo = 1 and ${fm.sql}`, fm.params)

  const eco = await economiaConsolidada(eid)

  const recentes = await todos<{
    id: number; numero: string; titulo: string; status: string; encerra_em: string | null
    comprador: string; itens: number; respostas: number; convites: number
  }>(
    `select c.id, c.numero, c.titulo, c.status, c.encerra_em, u.nome as comprador,
            (select count(*) from cotacao_itens where cotacao_id = c.id) itens,
            (select count(*) from cotacao_fornecedores where cotacao_id = c.id and status = 'respondido') respostas,
            (select count(*) from cotacao_fornecedores where cotacao_id = c.id) convites
       from cotacoes c join usuarios u on u.id = c.comprador_id
      ${eid ? 'where c.empresa_id = ?' : ''}
      order by c.criado_em desc limit 8`, p)

  const proximos = await todos<{ id: number; nome: string; dias_semana: string; horario: string; canal: string; proximo_disparo: string }>(
    `select id, nome, dias_semana, horario, canal, proximo_disparo from agendamentos
      where ${daEmpresa} and ativo = 1 order by proximo_disparo limit 4`, p)

  const conectores = await todos<{ id: number; erp: string; status: string; direcao: string; ultima_sinc: string | null }>(
    `select id, erp, status, direcao, ultima_sinc from erp_conectores ${fEmp} order by
      case status when 'erro' then 0 when 'homologacao' then 1 when 'ativo' then 2 else 3 end limit 5`, p)

  const topEconomia = [...eco.porCotacao].sort((a, b) => b.economia - a.economia).slice(0, 6)

  return (
    <>
      <CabecalhoPagina
        icone={<IconePainel size={19} />}
        titulo={`Visão geral${s.empresa ? ` · ${s.empresa.nome_fantasia}` : ''}`}
        descricao="Situação das cotações, economia apurada e saúde das integrações."
        acoes={<Link href="/cotacoes" className="btn btn-primario">Ver cotações<IconeSeta size={15} /></Link>}
      />

      <GradeKpis>
        <Kpi icone={<IconeBalanca size={14} />} rotulo="Cotações em curso" valor={numero(emAndamento)}
             apoio={`${numero(aguardando)} fornecedores ainda sem resposta`} />
        <Kpi icone={<IconeMoeda size={14} />} rotulo="Economia apurada" valor={moedaCurta(eco.economiaValor)} tom="positivo"
             apoio={`${percentual(eco.economiaPct)} sobre ${numero(eco.cotacoes)} cotações equalizadas`} />
        <Kpi icone={<IconeCamada size={14} />} rotulo="Ganho por pulverização" valor={moedaCurta(eco.ganhoPulverizacao)}
             apoio="Menor preço por item vs. menor preço global" />
        <Kpi icone={<IconeCaixa size={14} />} rotulo="Base disponível" valor={numero(materiaisVisiveis)}
             apoio={`materiais · ${numero(fornecedoresHomologados)} fornecedores homologados`} />
      </GradeKpis>

      <div className="grid xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 sm:gap-5 mt-4 sm:mt-5">
        {/* --------------------------------------------- cotacoes recentes */}
        <Painel semPadding icone={<IconeBalanca size={15} />} titulo="Cotações recentes"
          acao={<Link href="/cotacoes" className="text-xs text-ink-500 hover:text-ink-900 transition-colors">Ver todas</Link>}>
          {recentes.length === 0 ? (
            <Vazio icone={<IconeBalanca size={20} />} titulo="Nenhuma cotação nesta empresa"
              descricao="Cotações aparecem aqui assim que forem criadas a partir de uma demanda." />
          ) : (
            <div className="rolagem-x">
              <table className="tabela tabela-cartoes">
                <thead>
                  <tr>
                    <th>Cotação</th>
                    <th className="hidden 2xl:table-cell">Comprador</th>
                    <th className="num">Itens</th>
                    <th className="num">Respostas</th>
                    <th className="hidden 2xl:table-cell">Encerra</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentes.map((c) => (
                    <tr key={c.id}>
                      <td data-p>
                        <Link href={`/cotacoes/${c.id}`} className="block group">
                          <span className="block text-sm text-ink-900 group-hover:text-petrol-700 font-medium md:font-normal
                                           md:truncate md:max-w-[230px] transition-colors">{c.titulo}</span>
                          <span className="texto-mono text-2xs text-ink-500">{c.numero}</span>
                        </Link>
                      </td>
                      <td data-r="Comprador" className="text-sm text-ink-600 whitespace-nowrap
                                 md:hidden 2xl:table-cell">
                        <span className="inline-flex items-center gap-1.5">
                          <IconeUsuario size={13} className="text-ink-400 hidden md:inline" />
                          {c.comprador.split(' ').slice(0, 2).join(' ')}
                        </span>
                      </td>
                      <td data-r="Itens" className="num text-sm">{numero(c.itens)}</td>
                      <td data-r="Respostas" className="num text-sm whitespace-nowrap">
                        <span className={c.respostas > 0 ? 'text-ink-900 font-medium' : 'text-ink-400'}>{c.respostas}</span>
                        <span className="text-ink-400">/{c.convites}</span>
                      </td>
                      <td data-r="Encerra" className="text-xs text-ink-500 whitespace-nowrap md:hidden 2xl:table-cell">
                        {data(c.encerra_em)}
                      </td>
                      <td data-r="Status"><StatusTag status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Painel>

        <div className="space-y-4 sm:space-y-5 min-w-0">
          {/* ------------------------------------------ disparos programados */}
          <Painel semPadding icone={<IconeRelogio size={15} />} titulo="Próximos disparos"
            acao={<Link href="/agendamentos" className="text-xs text-ink-500 hover:text-ink-900 transition-colors">Configurar</Link>}>
            {proximos.length === 0 ? (
              <Vazio icone={<IconeRelogio size={20} />} titulo="Sem agendamentos ativos"
                descricao="Configure janelas de disparo para as rodadas saírem sozinhas." />
            ) : (
              <ul className="divide-y divide-ink-100">
                {proximos.map((a) => (
                  <li key={a.id} className="px-4 sm:px-5 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink-900 truncate">{a.nome}</p>
                      <p className="text-xs text-ink-500 mt-0.5">
                        {a.dias_semana} · {a.horario} · via {a.canal === 'ambos' ? 'e-mail e portal' : a.canal}
                      </p>
                    </div>
                    <span className="text-xs text-ink-500 whitespace-nowrap shrink-0 tabular">
                      {dataHora(a.proximo_disparo).slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Painel>

          {/* ------------------------------------------ integracoes */}
          <Painel semPadding icone={<IconeConector size={15} />} titulo="Integrações ERP"
            acao={<Link href="/integracoes" className="text-xs text-ink-500 hover:text-ink-900 transition-colors">Detalhar</Link>}>
            {conectores.length === 0 ? (
              <Vazio icone={<IconeConector size={20} />} titulo="Nenhum conector configurado" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {conectores.map((c) => (
                  <li key={c.id} className="px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink-900 truncate">{c.erp}</p>
                      <p className="text-xs text-ink-500">
                        {c.direcao} · sinc. {c.ultima_sinc ? dataRelativa(c.ultima_sinc) : 'nunca'}
                      </p>
                    </div>
                    <StatusTag status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </div>
      </div>

      {/* ---------------------------------------------- economia por cotacao */}
      <div className="mt-4 sm:mt-5">
        <Painel semPadding icone={<IconeGrafico size={15} />} titulo="Maiores economias apuradas"
          acao={<span className="text-xs text-ink-500 hidden sm:block">Menor preço por item vs. orçamento de referência</span>}>
          {topEconomia.length === 0 ? (
            <Vazio icone={<IconeQueda size={20} />} titulo="Nenhuma cotação equalizada ainda"
              descricao="A economia é apurada quando a cotação encerra e o motor de equalização roda." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {topEconomia.map((c) => (
                <li key={c.id} className="px-4 sm:px-5 py-3">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <Link href={`/cotacoes/${c.id}/equalizacao`}
                            className="text-sm text-ink-900 hover:text-petrol-700 truncate block transition-colors">
                        {c.titulo}
                      </Link>
                      <p className="text-2xs texto-mono text-ink-500">{c.numero}</p>
                    </div>
                    <div className="w-24 lg:w-32 hidden sm:block">
                      <Barra valor={c.economia * 2.5} cor="bg-positive-600" />
                    </div>
                    <div className="text-right shrink-0 w-24 sm:w-28">
                      <p className="text-sm font-semibold tabular text-positive-700">{percentual(c.economia)}</p>
                      <p className="text-xs text-ink-500 tabular">{moeda(c.referencia - c.melhor)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      {demandasAbertas > 0 && (
        <div className="mt-4 flex items-center gap-2.5 text-xs text-ink-500">
          <Tag variante="atencao" icone={<IconeLista size={11} />}>
            {numero(demandasAbertas)} demandas abertas
          </Tag>
          <Link href="/demandas?status=aberta" className="hover:text-ink-900 transition-colors">
            aguardando conversão em cotação
          </Link>
        </div>
      )}
    </>
  )
}
