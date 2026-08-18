import { sessao } from '@/lib/sessao'
import { todos, um } from '@/lib/db'
import { numero, dataHora, dataRelativa, dec } from '@/lib/formato'
import { Painel, CabecalhoPagina, Vazio, Tag, Kpi, GradeKpis, Barra } from '@/components/ui'
import { IconeRelogio, IconeEnvio, IconeCalendario, IconeCheck, IconeGrafico, IconeRaio } from '@/components/icones'

export const dynamic = 'force-dynamic'
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default async function PaginaAgendamentos() {
  const s = await sessao()
  const eid = s.empresa?.id ?? null
  const p = eid ? [eid] : []
  // Predicado sempre valido, com ou sem empresa no contexto
  const daEmpresa = eid ? 'empresa_id = ?' : '1=1'
  const onde = eid ? 'where empresa_id = ?' : ''

  const agendamentos = await todos<{
    id: number; nome: string; dias_semana: string; horario: string; canal: string
    janela_resposta_horas: number; ativo: number; proximo_disparo: string; criado_em: string; disparos: number
  }>(
    `select a.*, (select count(*) from disparo_logs dl where dl.agendamento_id = a.id) disparos
       from agendamentos a where ${eid ? 'a.empresa_id = ?' : '1=1'} order by a.ativo desc, a.proximo_disparo`, p)

  const logs = await todos<{
    canal: string; destinatarios: number; entregues: number; falhas: number
    origem: string; criado_em: string; cotacao: string | null; cotacao_id: number | null
  }>(
    `select dl.canal, dl.destinatarios, dl.entregues, dl.falhas, dl.origem, dl.criado_em,
            c.numero as cotacao, c.id as cotacao_id
       from disparo_logs dl left join cotacoes c on c.id = dl.cotacao_id
      where ${eid ? 'dl.empresa_id = ?' : '1=1'} order by dl.criado_em desc limit 25`, p)

  const totalEnvios = await um<{ d: number; e: number; f: number }>(
    `select sum(destinatarios) d, sum(entregues) e, sum(falhas) f from disparo_logs ${onde}`, p)
  const entregues = totalEnvios?.e ?? 0
  const destinatarios = totalEnvios?.d ?? 0
  const automaticos = (await um<{ c: number }>(
    `select count(*) c from disparo_logs where ${daEmpresa} and origem = 'agendamento'`, p))?.c ?? 0
  const totalLogs = (await um<{ c: number }>(`select count(*) c from disparo_logs ${onde}`, p))?.c ?? 0

  return (
    <>
      <CabecalhoPagina icone={<IconeRelogio size={19} />} titulo="Disparos programados"
        descricao="Rodadas de cotação enviadas em dias e horários parametrizados pelo administrador, com disparo manual disponível para exceções." />

      <GradeKpis>
        <Kpi icone={<IconeCalendario size={14} />} rotulo="Agendamentos ativos" valor={numero(agendamentos.filter((a) => a.ativo).length)}
             apoio={`${numero(agendamentos.length)} configurados no total`} />
        <Kpi icone={<IconeEnvio size={14} />} rotulo="Convites entregues" valor={numero(entregues)}
             apoio={`de ${numero(destinatarios)} destinatários`} />
        <Kpi icone={<IconeCheck size={14} />} rotulo="Taxa de entrega" valor={destinatarios ? `${dec((entregues / destinatarios) * 100, 1)}%` : '—'}
             tom="positivo" apoio={`${numero((totalEnvios?.f ?? 0))} falhas tratadas com reenvio`} />
        <Kpi icone={<IconeRaio size={14} />} rotulo="Disparos automáticos" valor={totalLogs ? `${Math.round((automaticos / totalLogs) * 100)}%` : '—'}
             apoio={`${numero(automaticos)} de ${numero(totalLogs)} rodadas`} />
      </GradeKpis>

      <div className="grid xl:grid-cols-2 gap-4 sm:gap-5 mt-4 sm:mt-5">
        <Painel semPadding icone={<IconeCalendario size={15} />} titulo="Janelas configuradas">
          {agendamentos.length === 0 ? <Vazio icone={<IconeCalendario size={20} />} titulo="Nenhum agendamento configurado" descricao="As janelas de disparo são parâmetros do administrador da plataforma." /> : (
            <ul className="divide-y divide-ink-100">
              {agendamentos.map((a) => {
                const ativos = a.dias_semana.split(',').map((d) => d.trim())
                return (
                  <li key={a.id} className="px-4 sm:px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900">{a.nome}</p>
                        <p className="text-xs text-ink-500 mt-1">
                          {a.horario} · janela de resposta de {a.janela_resposta_horas}h · via{' '}
                          {a.canal === 'ambos' ? 'e-mail e portal' : a.canal}
                        </p>
                      </div>
                      <Tag variante={a.ativo ? 'positiva' : 'neutra'} ponto>{a.ativo ? 'Ativo' : 'Pausado'}</Tag>
                    </div>
                    <div className="flex items-center gap-1 mt-3">
                      {DIAS.map((d) => (
                        <span key={d}
                          className={`w-8 h-6 rounded grid place-items-center text-2xs font-medium border ${
                            ativos.includes(d) ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-400 border-ink-200'}`}>
                          {d}
                        </span>
                      ))}
                      <span className="ml-auto text-xs text-ink-500 flex items-center gap-1.5">
                        <IconeRelogio size={13} />
                        {a.ativo ? `próximo em ${dataHora(a.proximo_disparo).slice(0, 10)}` : 'sem próximo disparo'}
                      </span>
                    </div>
                    {a.disparos > 0 && (
                      <p className="mt-2 text-2xs text-ink-400">{numero(a.disparos)} rodadas já disparadas por esta janela</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Painel>

        <Painel semPadding icone={<IconeEnvio size={15} />} titulo="Últimos envios">
          {logs.length === 0 ? <Vazio icone={<IconeEnvio size={20} />} titulo="Nenhum envio registrado" /> : (
            <ul className="divide-y divide-ink-100">
              {logs.map((l, i) => (
                <li key={i} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                  <span className={l.falhas > 0 ? 'text-caution-700' : 'text-ink-400'}><IconeEnvio size={15} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-900 truncate">
                      {l.cotacao ?? 'Rodada avulsa'}{' '}
                      <span className="text-xs text-ink-500">
                        · {l.origem === 'agendamento' ? 'automático' : 'manual'}
                      </span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-ink-500 tabular whitespace-nowrap">{l.entregues}/{l.destinatarios}</span>
                      <span className="w-16"><Barra valor={l.destinatarios ? l.entregues / l.destinatarios : 0}
                        cor={l.falhas > 0 ? 'bg-caution-600' : 'bg-positive-600'} /></span>
                      {l.falhas > 0 && <span className="text-2xs text-critical-700">{l.falhas} falha(s)</span>}
                    </div>
                  </div>
                  <span className="text-xs text-ink-500 whitespace-nowrap">{dataRelativa(l.criado_em)}</span>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      <p className="mt-4 text-xs text-ink-500 max-w-3xl">
        As janelas são parâmetros do administrador central: dias da semana, horário, canal e prazo de resposta.
        Fora delas, o comprador dispara manualmente uma rodada excepcional, e ambos os caminhos ficam
        registrados no histórico com origem identificada.
      </p>
    </>
  )
}
