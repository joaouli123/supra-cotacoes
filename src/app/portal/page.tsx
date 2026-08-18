import Link from 'next/link'
import { sessao } from '@/lib/sessao'
import { todos } from '@/lib/db'
import { numero, data, dataRelativa } from '@/lib/formato'
import { Painel, Vazio, StatusTag, Tag, Kpi, GradeKpis } from '@/components/ui'
import { IconeSeta, IconeAlerta, IconeCotacao, IconeCheck, IconeEnvio, IconeGrafico, IconePorta, IconeCalendario } from '@/components/icones'

export const dynamic = 'force-dynamic'

export default async function PortalInicio() {
  const s = await sessao()
  if (!s.fornecedor) {
    return (
      <>
        <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-ink-900 mb-5">
          Portal do fornecedor
        </h1>
        <Painel semPadding>
          <Vazio icone={<IconePorta size={20} />} titulo="Nenhum fornecedor na sessão"
            descricao="O acesso ao portal externo é feito pelo token do convite. Escolha o perfil Fornecedor na tela inicial para entrar."
            acao={<Link href="/api/contexto?perfil=fornecedor&voltar=/portal" className="btn btn-primario">
              Entrar como fornecedor<IconeSeta size={15} />
            </Link>} />
        </Painel>
      </>
    )
  }

  const convites = await todos<{
    token: string; status: string; convidado_em: string; respondido_em: string | null
    numero: string; titulo: string; encerra_em: string | null; cot_status: string
    empresa: string; itens: number
  }>(
    `select cf.token, cf.status, cf.convidado_em, cf.respondido_em,
            c.numero, c.titulo, c.encerra_em, c.status as cot_status, e.nome_fantasia as empresa,
            (select count(*) from cotacao_itens where cotacao_id = c.id) itens
       from cotacao_fornecedores cf
       join cotacoes c on c.id = cf.cotacao_id
       join empresas e on e.id = c.empresa_id
      where cf.fornecedor_id = ? and c.status in ('em_andamento','encerrada','equalizada')
      order by case cf.status when 'convidado' then 0 when 'visualizado' then 1 else 2 end,
               cf.convidado_em desc
      limit 40`, [s.fornecedor.id])

  const pendentes = convites.filter((c) => c.status !== 'respondido' && c.cot_status === 'em_andamento')
  const respondidos = convites.filter((c) => c.status === 'respondido')

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900">Suas cotações</h1>
        <p className="text-sm text-ink-500 mt-1">
          {s.fornecedor.razao_social} · convites recebidos das empresas compradoras.
        </p>
      </div>

      <GradeKpis>
        <Kpi icone={<IconeAlerta size={14} />} rotulo="Aguardando sua resposta" valor={numero(pendentes.length)}
             tom={pendentes.length > 0 ? 'atencao' : 'neutro'} apoio="cotações em aberto" />
        <Kpi icone={<IconeCheck size={14} />} rotulo="Propostas enviadas" valor={numero(respondidos.length)} apoio="no período" />
        <Kpi icone={<IconeEnvio size={14} />} rotulo="Convites recebidos" valor={numero(convites.length)} apoio="histórico recente" />
        <Kpi icone={<IconeGrafico size={14} />} rotulo="Taxa de resposta"
             valor={convites.length ? `${((respondidos.length / convites.length) * 100).toFixed(0)}%` : '—'}
             apoio="acompanhada pelo comprador" />
      </GradeKpis>

      {pendentes.length > 0 && (
        <div className="mt-4 sm:mt-5">
          <Painel semPadding icone={<IconeAlerta size={15} />} titulo={`Aguardando resposta (${pendentes.length})`}
            acao={<span className="text-xs text-caution-700 flex items-center gap-1.5"><IconeAlerta size={13} />prazos em curso</span>}>
            <ul className="divide-y divide-ink-100">
              {pendentes.map((c) => (
                <li key={c.token}>
                  <Link href={`/portal/cotacao/${c.token}`}
                        className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-ink-50 group transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-900 group-hover:text-petrol-700 truncate">{c.titulo}</p>
                      <p className="text-xs text-ink-500 mt-0.5">
                        <span className="texto-mono">{c.numero}</span> · {c.empresa} · {c.itens} itens
                      </p>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-xs text-ink-500">Encerra em</p>
                      <p className="text-sm text-ink-900 tabular">{data(c.encerra_em)}</p>
                    </div>
                    <StatusTag status={c.status} />
                    <span className="text-ink-300 group-hover:text-ink-900 transition-colors"><IconeSeta size={16} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </Painel>
        </div>
      )}

      <div className="mt-4 sm:mt-5">
        <Painel semPadding icone={<IconeCotacao size={15} />} titulo="Histórico de participação">
          {convites.length === 0 ? (
            <Vazio icone={<IconeCotacao size={20} />} titulo="Nenhum convite recebido"
              descricao="Você é convidado automaticamente para cotações dos grupos de materiais que fornece." />
          ) : (
            <div className="rolagem-x">
              <table className="tabela tabela-cartoes">
                <thead><tr>
                  <th>Cotação</th><th>Empresa compradora</th><th className="num">Itens</th>
                  <th>Convite</th><th>Sua resposta</th><th>Situação</th><th></th>
                </tr></thead>
                <tbody>
                  {convites.map((c) => (
                    <tr key={c.token}>
                      <td data-p>
                        <span className="block text-sm text-ink-900 font-medium md:font-normal md:truncate md:max-w-[240px]">{c.titulo}</span>
                        <span className="texto-mono text-2xs text-ink-500">{c.numero}</span>
                      </td>
                      <td data-r="Empresa" className="text-sm text-ink-600 whitespace-nowrap">{c.empresa}</td>
                      <td data-r="Itens" className="num text-sm">{c.itens}</td>
                      <td data-r="Convite" className="text-xs text-ink-500 whitespace-nowrap">{dataRelativa(c.convidado_em)}</td>
                      <td data-r="Sua resposta" className="text-xs text-ink-500 whitespace-nowrap">
                        {c.respondido_em ? dataRelativa(c.respondido_em) : '—'}
                      </td>
                      <td data-r="Situação"><StatusTag status={c.status} /></td>
                      <td data-a className="text-right">
                        <Link href={`/portal/cotacao/${c.token}`} className="btn btn-secundario btn-sm">
                          {c.status === 'respondido' ? 'Ver proposta' : 'Responder'}
                          <IconeSeta size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Painel>
      </div>
    </>
  )
}
