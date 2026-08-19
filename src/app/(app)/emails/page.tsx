// =====================================================================
// Central de e-mail: o que esta configurado, o que ja saiu e o que falhou.
//
// A tela existe porque envio e a unica parte do sistema cujo resultado
// acontece fora dele. Cadastro gravado a pessoa ve na lista; mensagem
// entregue, nao — sem este registro, "o fornecedor nao recebeu" seria
// impossivel de responder.
//
// Nenhum valor secreto aparece aqui. Host, porta, usuario e remetente sao
// dados de configuracao; a senha nunca sai do processo, nem mascarada.
// =====================================================================
import Link from 'next/link'
import { exigir } from '@/lib/acesso'
import { todos, um } from '@/lib/db'
import { numero, dataHora, dataRelativa } from '@/lib/formato'
import { lerRecado } from '@/lib/flash'
import { configuracao } from '@/lib/email'
import { Retorno, Recusa } from '@/components/Acoes'
import { Filtros } from '@/components/Filtros'
import {
  Painel, Paginacao, CabecalhoPagina, Vazio, StatusTag, Tag, Kpi, GradeKpis, Aviso,
} from '@/components/ui'
import {
  IconeEmail, IconeEnvio, IconeCheck, IconeAlerta, IconeRelogio, IconeInfo,
  IconeCadeado, IconeBusca, IconeEscudo,
} from '@/components/icones'

export const dynamic = 'force-dynamic'
const POR_PAGINA = 30

const ROTULO_TIPO: Record<string, string> = {
  convite: 'Convite de cotação',
  lembrete: 'Lembrete de prazo',
  encerramento: 'Aviso de encerramento',
  teste: 'Teste de configuração',
}

const ROTULO_MODO: Record<string, { titulo: string; texto: string }> = {
  real: {
    titulo: 'Envio real',
    texto: 'As mensagens vão para o endereço cadastrado de cada fornecedor.',
  },
  redirecionado: {
    titulo: 'Envio redirecionado',
    texto:
      'O envio acontece de verdade, pelo servidor SMTP, mas toda mensagem cai numa caixa única — ' +
      'com o destinatário pretendido no assunto. É o modo seguro para operar com base de demonstração: ' +
      'os fornecedores de exemplo têm domínio fictício, e disparar contra eles geraria devolução em ' +
      'massa e queimaria a reputação da conta remetente.',
  },
  simulado: {
    titulo: 'Envio simulado',
    texto: 'Nada sai da plataforma. As mensagens são registradas no histórico e descartadas.',
  },
}

export default async function PaginaEmails({ searchParams }: { searchParams: { [k: string]: string | undefined } }) {
  const s = await exigir('emails')
  const eid = s.empresa?.id ?? null
  const c = configuracao()

  const estado = searchParams.estado ?? ''
  const tipo = searchParams.tipo ?? ''
  const q = (searchParams.q ?? '').trim()
  const pagina = Math.max(1, Number(searchParams.pagina ?? 1))
  const recado = lerRecado(searchParams.f)

  const cond: string[] = ['1=1']
  const par: Array<string | number> = []
  if (eid) { cond.push('(e.empresa_id = ? or e.empresa_id is null)'); par.push(eid) }
  if (estado) { cond.push('e.estado = ?'); par.push(estado) }
  if (tipo) { cond.push('e.tipo = ?'); par.push(tipo) }
  if (q) { cond.push('(e.para like ? or e.assunto like ?)'); par.push(`%${q}%`, `%${q}%`) }
  const onde = cond.join(' and ')

  const total = Number((await um<{ c: number }>(`select count(*) c from email_logs e where ${onde}`, par))?.c ?? 0)

  const linhas = await todos<{
    id: number; cotacao_id: number | null; tipo: string; para: string; entregue_para: string
    assunto: string; modo: string; estado: string; erro: string | null; ms: number; criado_em: string
    numero: string | null
  }>(
    `select e.*, c.numero
       from email_logs e left join cotacoes c on c.id = e.cotacao_id
      where ${onde} order by e.criado_em desc limit ? offset ?`,
    [...par, POR_PAGINA, (pagina - 1) * POR_PAGINA])

  const resumo = await um<{ total: number; enviados: number; falhas: number; media: number; ultimo: string | null }>(
    `select count(*) total,
            sum(case when e.estado in ('enviado','simulado') then 1 else 0 end) enviados,
            sum(case when e.estado = 'falhou' then 1 else 0 end) falhas,
            avg(e.ms) media, max(e.criado_em) ultimo
       from email_logs e ${eid ? 'where (e.empresa_id = ? or e.empresa_id is null)' : ''}`,
    eid ? [eid] : [])

  const enviados = Number(resumo?.enviados ?? 0)
  const falhas = Number(resumo?.falhas ?? 0)
  const geral = Number(resumo?.total ?? 0)
  const taxa = geral > 0 ? enviados / geral : 0
  const modo = ROTULO_MODO[c.modo]

  const filtroBase = ['estado', 'tipo', 'q']
    .filter((k) => searchParams[k])
    .map((k) => `${k}=${encodeURIComponent(searchParams[k] as string)}`)
    .join('&')

  return (
    <>
      <CabecalhoPagina icone={<IconeEmail size={19} />} titulo="E-mails"
        descricao="Configuração do servidor de saída e registro de cada mensagem que a plataforma tentou entregar — com o motivo, quando falhou." />

      <Retorno ok={searchParams.ok} />
      <Recusa mensagem={recado?.erros._} />

      <GradeKpis>
        <Kpi icone={<IconeEnvio size={14} />} rotulo="Mensagens" valor={numero(geral)}
             apoio={resumo?.ultimo ? `última ${dataRelativa(resumo.ultimo)}` : 'nenhuma ainda'} />
        <Kpi icone={<IconeCheck size={14} />} rotulo="Aceitas pelo servidor" valor={numero(enviados)}
             tom={taxa >= 0.95 ? 'positivo' : 'atencao'} apoio={`${(taxa * 100).toFixed(1)}% do total`} />
        <Kpi icone={<IconeAlerta size={14} />} rotulo="Falhas" valor={numero(falhas)}
             tom={falhas > 0 ? 'atencao' : 'neutro'} apoio={falhas > 0 ? 'veja o motivo no histórico' : 'nenhuma recusa'} />
        <Kpi icone={<IconeRelogio size={14} />} rotulo="Tempo médio" valor={`${Math.round(Number(resumo?.media ?? 0))} ms`}
             apoio="por mensagem entregue ao servidor" />
      </GradeKpis>

      <div className="grid xl:grid-cols-2 gap-4 sm:gap-5 mt-4 sm:mt-5 min-w-0">
        {/* ------------------------------------------------ configuracao -- */}
        <Painel icone={<IconeCadeado size={15} />} titulo="Servidor de saída"
          acao={<Tag variante={c.pronto ? 'positiva' : 'critica'} ponto>{c.pronto ? 'Configurado' : 'Incompleto'}</Tag>}>
          <dl className="grid grid-cols-[auto,1fr] gap-x-5 gap-y-2 text-sm">
            <dt className="text-ink-500">Servidor</dt>
            <dd className="text-ink-900 texto-mono text-xs sm:text-sm break-all">
              {c.host || <span className="text-critical-700">não definido</span>}
              {c.host && <span className="text-ink-400">:{c.porta}</span>}
            </dd>

            <dt className="text-ink-500">Segurança</dt>
            <dd className="text-ink-900">
              {c.implicito ? 'TLS direto (porta 465)' : 'STARTTLS'}
              <span className="block text-xs text-ink-500 mt-0.5">
                {c.implicito
                  ? 'A conexão já nasce cifrada.'
                  : 'A conexão sobe para TLS antes da autenticação; sem STARTTLS o envio é abortado.'}
              </span>
            </dd>

            <dt className="text-ink-500">Remetente</dt>
            <dd className="text-ink-900 break-all">
              {c.remetente ? <>{c.nome} &lt;{c.remetente}&gt;</> : <span className="text-critical-700">não definido</span>}
            </dd>

            {c.responderPara && (<>
              <dt className="text-ink-500">Responder para</dt>
              <dd className="text-ink-900 break-all">{c.responderPara}</dd>
            </>)}

            <dt className="text-ink-500">Endereço público</dt>
            <dd className="text-ink-900 texto-mono text-xs break-all">
              {c.base || <span className="text-critical-700">APP_URL não definida</span>}
            </dd>

            <dt className="text-ink-500">Modo</dt>
            <dd>
              <Tag variante={c.modo === 'real' ? 'positiva' : c.modo === 'simulado' ? 'neutra' : 'atencao'} ponto>
                {modo.titulo}
              </Tag>
              {c.modo === 'redirecionado' && c.redirecionarPara && (
                <span className="block text-xs text-ink-500 mt-1 break-all">
                  Tudo cai em <span className="texto-mono text-ink-700">{c.redirecionarPara}</span>
                </span>
              )}
            </dd>
          </dl>

          <p className="text-xs text-ink-500 mt-4 pt-3 border-t border-ink-100">{modo.texto}</p>

          {c.problemas.length > 0 && (
            <div className="mt-4">
              <Aviso tom="atencao" icone={<IconeAlerta size={16} />} titulo="Pendências de configuração">
                <ul className="list-disc pl-4 space-y-1">
                  {c.problemas.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </Aviso>
            </div>
          )}
        </Painel>

        {/* ------------------------------------------------------- teste -- */}
        <Painel icone={<IconeEnvio size={15} />} titulo="Enviar mensagem de teste">
          <p className="text-sm text-ink-600">
            Manda uma mensagem real pelo servidor configurado, com acentuação, tabela e link, para
            conferir o caminho inteiro — conexão, autenticação e formatação — sem precisar disparar
            uma cotação.
          </p>

          <form method="post" action="/api/email" className="mt-4 space-y-3">
            <input type="hidden" name="_op" value="teste" />
            <input type="hidden" name="_voltar" value="/emails" />
            <div>
              <label htmlFor="para" className="rotulo">Enviar para</label>
              <input id="para" name="para" type="email" required autoComplete="off"
                     defaultValue={s.usuario.email} placeholder="voce@empresa.com.br"
                     className="campo" />
            </div>
            <button type="submit" className="btn btn-primario btn-sm" disabled={!c.pronto}>
              <IconeEnvio size={15} /> Enviar teste
            </button>
            {!c.pronto && (
              <p className="text-xs text-critical-700">
                Defina SMTP_HOST, SMTP_USUARIO e SMTP_SENHA no ambiente antes de testar.
              </p>
            )}
          </form>

          <div className="mt-5 pt-4 border-t border-ink-100">
            <p className="text-xs text-ink-500">
              O teste vai para o endereço digitado mesmo quando o modo é <em>redirecionado</em> ou{' '}
              <em>simulado</em>: quem digitou está autenticado e sabe para onde está mandando, e um
              teste desviado não testaria nada. Os disparos de cotação continuam obedecendo ao modo.
            </p>
          </div>
        </Painel>
      </div>

      {/* --------------------------------------------------- historico -- */}
      <div className="mt-5">
        <Filtros acao="/emails" busca={q} placeholder="Buscar por destinatário ou assunto…"
          selects={[
            { nome: 'estado', valor: estado, vazio: 'Todos os estados', rotulo: 'Estado', opcoes: [
              { valor: 'enviado', rotulo: 'Enviado' },
              { valor: 'falhou', rotulo: 'Falhou' },
              { valor: 'simulado', rotulo: 'Simulado' }] },
            { nome: 'tipo', valor: tipo, vazio: 'Todos os tipos', rotulo: 'Tipo', opcoes: [
              { valor: 'convite', rotulo: 'Convite de cotação' },
              { valor: 'lembrete', rotulo: 'Lembrete de prazo' },
              { valor: 'encerramento', rotulo: 'Aviso de encerramento' },
              { valor: 'teste', rotulo: 'Teste de configuração' }] },
          ]} />
      </div>

      <Painel semPadding icone={<IconeEscudo size={15} />} titulo="Histórico de envios">
        {linhas.length === 0 ? (
          <Vazio icone={<IconeBusca size={20} />} titulo="Nenhuma mensagem registrada"
            descricao={total === 0 && !estado && !tipo && !q
              ? 'Assim que uma cotação for disparada, cada mensagem aparece aqui com o resultado do servidor.'
              : 'Ajuste a busca ou remova algum filtro.'}
            acao={estado || tipo || q
              ? <Link href="/emails" className="btn btn-secundario btn-sm">Limpar filtros</Link>
              : undefined} />
        ) : (
          <>
            <div className="rolagem-x">
              <table className="tabela tabela-cartoes">
                <thead><tr>
                  <th>Destinatário</th><th>Tipo</th><th>Rodada</th>
                  <th className="num">Tempo</th><th>Quando</th><th>Estado</th>
                </tr></thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.id}>
                      <td data-p>
                        <span className="text-sm text-ink-800 font-medium md:font-normal md:text-xs break-all">{l.para}</span>
                        <span className="block text-2xs text-ink-400 truncar-2 max-w-[320px]">{l.assunto}</span>
                        {l.entregue_para !== l.para && (
                          <span className="block text-2xs text-caution-700 mt-0.5 break-all">
                            redirecionado para {l.entregue_para}
                          </span>
                        )}
                        {l.erro && (
                          <span className="block text-2xs text-critical-700 mt-0.5 truncar-2 max-w-[320px]">{l.erro}</span>
                        )}
                      </td>
                      <td data-r="Tipo" className="text-xs text-ink-600 whitespace-nowrap">
                        {ROTULO_TIPO[l.tipo] ?? l.tipo}
                      </td>
                      <td data-r="Rodada" className="text-xs">
                        {l.cotacao_id && l.numero
                          ? <Link href={`/cotacoes/${l.cotacao_id}`} className="texto-mono text-petrol-700 hover:underline">{l.numero}</Link>
                          : <span className="text-ink-400">—</span>}
                      </td>
                      <td data-r="Tempo" className="num text-xs text-ink-600 whitespace-nowrap">{numero(l.ms)} ms</td>
                      <td data-r="Quando" className="text-xs text-ink-500 whitespace-nowrap">{dataHora(l.criado_em)}</td>
                      <td data-r="Estado"><StatusTag status={l.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao base={`/emails${filtroBase ? `?${filtroBase}` : ''}`}
                       pagina={pagina} porPagina={POR_PAGINA} total={total} />
          </>
        )}
      </Painel>

      <div className="mt-4 sm:mt-5">
        <Aviso icone={<IconeInfo size={16} />} titulo="Como o envio funciona">
          <div className="space-y-2 max-w-4xl">
            <p>
              O disparo de uma cotação grava a rodada e devolve a tela na hora; as mensagens saem em
              seguida, quatro por vez, e as contagens de entregues e falhas sobem conforme cada uma
              resolve. Atualizar a página da cotação mostra o andamento.
            </p>
            <p>
              <strong className="text-ink-800 font-medium">Aceita pelo servidor</strong> significa que o
              SMTP respondeu 250 — a mensagem foi assumida para entrega. Recusa definitiva (código 5xx,
              como caixa inexistente) não é repetida; recusa temporária (4xx) e queda de conexão têm
              uma segunda tentativa.
            </p>
            <p>
              O convite carrega um link com o token do fornecedor: ele responde sem criar conta e sem
              senha. Quem já respondeu não recebe lembrete nem reenvio.
            </p>
          </div>
        </Aviso>
      </div>
    </>
  )
}
