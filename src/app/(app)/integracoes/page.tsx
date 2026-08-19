import { exigir } from '@/lib/acesso'
import { todos, um } from '@/lib/db'
import { numero, dataRelativa, dec } from '@/lib/formato'
import { Painel, CabecalhoPagina, Vazio, StatusTag, Tag, Kpi, GradeKpis, Aviso } from '@/components/ui'
import { IconeAlerta, IconeConector, IconeSincronia, IconeCheck, IconeRelogio, IconeBanco, IconeInfo } from '@/components/icones'

export const dynamic = 'force-dynamic'

export default async function PaginaIntegracoes({ searchParams }: { searchParams: { [k: string]: string | undefined } }) {
  const s = await exigir('integracoes')
  const eid = s.empresa?.id ?? null
  const p = eid ? [eid] : []
  const filtroConector = searchParams.conector ?? ''

  const conectores = await todos<{
    id: number; erp: string; versao: string; protocolo: string; direcao: string; entidades: string
    status: string; endpoint: string; frequencia: string; ultima_sinc: string | null
    empresa: string; eventos: number; erros: number
  }>(
    `select c.*, e.nome_fantasia as empresa,
            (select count(*) from erp_eventos ev where ev.conector_id = c.id) eventos,
            (select count(*) from erp_eventos ev where ev.conector_id = c.id and ev.status = 'erro') erros
       from erp_conectores c join empresas e on e.id = c.empresa_id
      ${eid ? 'where c.empresa_id = ?' : ''}
      order by case c.status when 'erro' then 0 when 'homologacao' then 1 when 'ativo' then 2 else 3 end, c.erp`, p)

  const condEv: string[] = ['1=1']
  const parEv: Array<string | number> = []
  if (eid) { condEv.push('c.empresa_id = ?'); parEv.push(eid) }
  if (filtroConector) { condEv.push('ev.conector_id = ?'); parEv.push(Number(filtroConector)) }

  const eventos = await todos<{
    id: number; entidade: string; direcao: string; referencia: string; registros: number
    status: string; tentativas: number; duracao_ms: number; mensagem: string | null
    criado_em: string; erp: string
  }>(
    `select ev.*, c.erp from erp_eventos ev join erp_conectores c on c.id = ev.conector_id
      where ${condEv.join(' and ')} order by ev.criado_em desc limit 30`, parEv)

  const stats = await um<{ total: number; sucesso: number; erro: number; registros: number; media: number }>(
    `select count(*) total,
            sum(case when ev.status='sucesso' then 1 else 0 end) sucesso,
            sum(case when ev.status='erro' then 1 else 0 end) erro,
            sum(ev.registros) registros, avg(ev.duracao_ms) media
       from erp_eventos ev join erp_conectores c on c.id = ev.conector_id
      ${eid ? 'where c.empresa_id = ?' : ''}`, p)

  const taxa = stats && stats.total > 0 ? stats.sucesso / stats.total : 0

  return (
    <>
      <CabecalhoPagina icone={<IconeConector size={19} />} titulo="Integrações com ERP"
        descricao="Conectores bidirecionais por empresa: o ERP alimenta cadastros e requisições, e o resultado da cotação retorna para virar pedido oficial no ERP da empresa tomadora." />

      <GradeKpis>
        <Kpi icone={<IconeConector size={14} />} rotulo="Conectores" valor={numero(conectores.length)}
             apoio={`${conectores.filter((c) => c.status === 'ativo').length} em produção`} />
        <Kpi icone={<IconeSincronia size={14} />} rotulo="Eventos processados" valor={numero(stats?.total ?? 0)}
             apoio={`${numero(stats?.registros ?? 0)} registros sincronizados`} />
        <Kpi icone={<IconeCheck size={14} />} rotulo="Taxa de sucesso" valor={`${dec(taxa * 100, 1)}%`} tom={taxa > 0.9 ? 'positivo' : 'atencao'}
             apoio={`${numero(stats?.erro ?? 0)} eventos em erro`} />
        <Kpi icone={<IconeRelogio size={14} />} rotulo="Tempo médio" valor={`${Math.round(stats?.media ?? 0)} ms`} apoio="por lote sincronizado" />
      </GradeKpis>

      <div className="grid xl:grid-cols-2 gap-4 sm:gap-5 mt-4 sm:mt-5 min-w-0">
        <Painel semPadding icone={<IconeBanco size={15} />} titulo="Conectores configurados">
          {conectores.length === 0 ? <Vazio icone={<IconeConector size={20} />} titulo="Nenhum conector configurado" /> : (
            <ul className="divide-y divide-ink-100">
              {conectores.map((c) => (
                <li key={c.id} className="px-4 sm:px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">
                        {c.erp} <span className="text-ink-400 font-normal text-xs">v{c.versao}</span>
                      </p>
                      <p className="text-xs text-ink-500 mt-0.5">{c.empresa}</p>
                    </div>
                    <StatusTag status={c.status} />
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <Tag variante="neutra">{c.protocolo}</Tag>
                    <Tag variante={c.direcao === 'bidirecional' ? 'ativa' : 'neutra'}>
                      {c.direcao === 'bidirecional' ? '↔ bidirecional' : c.direcao === 'entrada' ? '← entrada' : '→ saída'}
                    </Tag>
                    <Tag variante="neutra">{c.frequencia}</Tag>
                  </div>

                  <p className="mt-2.5 text-xs text-ink-500">
                    <span className="text-ink-400">Entidades:</span> {c.entidades}
                  </p>
                  <p className="mt-1 text-2xs texto-mono text-ink-400 truncate">{c.endpoint}</p>

                  <div className="mt-2.5 flex items-center justify-between gap-3 text-xs">
                    <span className="text-ink-500">
                      {numero(c.eventos)} eventos
                      {c.erros > 0 && <span className="text-critical-700"> · {c.erros} em erro</span>}
                    </span>
                    <span className="text-ink-500">
                      {c.ultima_sinc ? `sinc. ${dataRelativa(c.ultima_sinc)}` : 'nunca sincronizado'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Painel>

        <Painel semPadding icone={<IconeSincronia size={15} />} titulo="Fila de sincronização"
          acao={<span className="text-xs text-ink-500">Últimos 30 eventos</span>}>
          {eventos.length === 0 ? <Vazio icone={<IconeCheck size={20} />} titulo="Fila vazia" descricao="Nenhum evento pendente de sincronização." /> : (
            <div className="rolagem-x">
              <table className="tabela tabela-cartoes">
                <thead><tr>
                  <th>Referência</th><th>Entidade</th><th>Dir.</th>
                  <th className="num">Registros</th><th className="num">Duração</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {eventos.map((ev) => (
                    <tr key={ev.id}>
                      <td data-p>
                        <span className="texto-mono text-sm text-ink-800 font-medium md:font-normal md:text-xs">{ev.referencia}</span>
                        <span className="block text-2xs text-ink-400">{ev.erp} · {dataRelativa(ev.criado_em)}</span>
                        {ev.mensagem && (
                          <span className="block text-2xs text-critical-700 mt-0.5 max-w-[260px] truncar-2">
                            {ev.mensagem}
                          </span>
                        )}
                      </td>
                      <td data-r="Entidade" className="text-xs text-ink-600 whitespace-nowrap">{ev.entidade}</td>
                      <td data-r="Direção" className="text-xs text-ink-500">{ev.direcao === 'entrada' ? '← entrada' : '→ saída'}</td>
                      <td data-r="Registros" className="num text-sm">{numero(ev.registros)}</td>
                      <td data-r="Duração" className="num text-xs text-ink-600 whitespace-nowrap">{numero(ev.duracao_ms)} ms</td>
                      <td data-r="Status">
                        <StatusTag status={ev.status} />
                        {ev.tentativas > 1 && (
                          <span className="block text-2xs text-ink-400 mt-0.5">{ev.tentativas} tentativas</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Painel>
      </div>

      <div className="mt-4 sm:mt-5">
        <Aviso icone={<IconeInfo size={16} />} titulo="Como a integração bidirecional funciona">
          <div className="space-y-2 max-w-4xl">
            <p>
              Cada empresa da plataforma configura seus próprios conectores. A camada de integração é
              agnóstica ao ERP: normaliza os dados num contrato interno e delega ao adaptador específico
              (REST, SOAP, OData ou arquivo em SFTP) a conversa com o sistema de destino.
            </p>
            <p>
              <strong className="text-ink-800 font-medium">Entrada:</strong> materiais, fornecedores, centros de custo,
              unidades e requisições descem do ERP para a plataforma.{' '}
              <strong className="text-ink-800 font-medium">Saída:</strong> o resultado da equalização sobe como
              pedido de compra, onde segue a alçada de aprovação do próprio ERP da empresa tomadora.
            </p>
            <p>
              Toda troca é enfileirada, idempotente e reprocessável: falhas de rede ou rejeições de payload
              ficam registradas com a mensagem do destino e voltam para a fila conforme a política de retry.
            </p>
          </div>
        </Aviso>
      </div>
    </>
  )
}
