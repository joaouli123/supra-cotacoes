// =====================================================================
// Disparo dos convites por e-mail.
//
// Fica fora de `fluxo.ts` por uma razao de tempo, nao de organizacao: a
// transacao que muda o estado da cotacao precisa fechar em milissegundos,
// e mandar quarenta mensagens leva a dezena de segundos. Segurar a
// transacao aberta durante o envio prenderia uma conexao do pool e
// travaria a rodada inteira caso um servidor SMTP demorasse a responder.
//
// Entao o desenho e este: a transacao grava o disparo com contagem zerada e
// devolve o controle; o envio corre depois, fora dela, e vai somando
// `entregues` e `falhas` em `disparo_logs` a medida que cada mensagem
// resolve. Quem atualizar a pagina da cotacao ve os numeros subirem.
// =====================================================================
import { todos, um, executar } from './db'
import { enviarLote, configuracao, type Envio } from './email'
import { convite, lembrete, encerramento, type Item } from './mensagens'

/** Quantos itens da rodada cabem no corpo antes de virar ruido. */
const ITENS_NO_CORPO = 12

type Cabecalho = {
  id: number
  numero: string
  titulo: string
  empresa_id: number
  encerra_em: string | null
  empresa: string
}

type Destinatario = {
  cf_id: number
  token: string
  status: string
  fornecedor_id: number
  razao_social: string
  email: string
}

async function dados(cotacaoId: number) {
  const c = await um<Cabecalho>(
    `select c.id, c.numero, c.titulo, c.empresa_id, c.encerra_em,
            e.nome_fantasia as empresa
       from cotacoes c join empresas e on e.id = c.empresa_id
      where c.id = ?`, [cotacaoId])
  if (!c) return null

  const itens = await todos<Item & { total: number }>(
    `select m.descricao, ci.quantidade, u.sigla as unidade
       from cotacao_itens ci
       join materiais m on m.id = ci.material_id
       join unidades  u on u.id = ci.unidade_id
      where ci.cotacao_id = ? order by ci.ordem limit ${ITENS_NO_CORPO}`, [cotacaoId])

  const total = Number(
    (await um<{ c: number }>('select count(*) c from cotacao_itens where cotacao_id = ?', [cotacaoId]))?.c ?? 0)

  return { c, itens: itens as Item[], total }
}

const destinatarios = (cotacaoId: number, somentePendentes: boolean) =>
  todos<Destinatario>(
    `select cf.id as cf_id, cf.token, cf.status,
            f.id as fornecedor_id, f.razao_social, f.email
       from cotacao_fornecedores cf
       join fornecedores f on f.id = cf.fornecedor_id
      where cf.cotacao_id = ?
        ${somentePendentes ? "and cf.status in ('convidado','visualizado')" : ''}
      order by cf.id`, [cotacaoId])

/**
 * Endereco publico da plataforma.
 *
 * `APP_URL` manda, porque e o unico valor confiavel quando a mensagem sai
 * de um processo em segundo plano, sem requisicao por perto. O host da
 * requisicao entra so como socorro em desenvolvimento — atras do proxy ele
 * chega como o endereco interno do container e geraria link quebrado.
 */
export function baseDe(req: Request): string {
  const cfg = configuracao().base
  if (cfg) return cfg
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  if (!host) return ''
  const proto = req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

const linkPortal = (base: string, token: string) =>
  `${base}/api/portal?token=${encodeURIComponent(token)}`

/**
 * Monta e envia as mensagens de uma rodada.
 *
 * Nunca lanca. Chamada em segundo plano, uma excecao aqui viraria
 * `unhandledRejection` e derrubaria o processo inteiro — o container
 * reiniciaria por causa de um endereco de e-mail malformado.
 */
export async function enviarConvites(opc: {
  cotacaoId: number
  base: string
  tipo?: 'convite' | 'lembrete'
  /** Registro em `disparo_logs` a ser atualizado conforme as entregas resolvem. */
  disparoId?: number | null
  somentePendentes?: boolean
}): Promise<{ enviados: number; falhas: number }> {
  const tipo = opc.tipo ?? 'convite'
  try {
    const d = await dados(opc.cotacaoId)
    if (!d) return { enviados: 0, falhas: 0 }

    const alvos = await destinatarios(opc.cotacaoId, opc.somentePendentes ?? false)
    if (alvos.length === 0) return { enviados: 0, falhas: 0 }

    const itens: Envio[] = alvos.map((a) => {
      const link = linkPortal(opc.base, a.token)
      const m = tipo === 'lembrete'
        ? lembrete({
            fornecedor: a.razao_social, empresa: d.c.empresa,
            numero: d.c.numero, titulo: d.c.titulo,
            encerraEm: d.c.encerra_em, link,
          })
        : convite({
            fornecedor: a.razao_social, empresa: d.c.empresa,
            numero: d.c.numero, titulo: d.c.titulo,
            itens: d.itens, totalItens: d.total,
            encerraEm: d.c.encerra_em, link,
          })
      return {
        para: a.email, assunto: m.assunto, texto: m.texto, html: m.html,
        tipo, empresaId: d.c.empresa_id, cotacaoId: d.c.id, fornecedorId: a.fornecedor_id,
      }
    })

    // A contagem sobe a cada mensagem resolvida, e nao ao final: se o
    // processo cair no meio do lote, o que ja saiu continua contabilizado.
    const somar = async (ok: boolean) => {
      if (!opc.disparoId) return
      await executar(
        `update disparo_logs set ${ok ? 'entregues = entregues + 1' : 'falhas = falhas + 1'} where id = ?`,
        [opc.disparoId])
    }

    return await enviarLote(itens, (r) => somar(r.ok))
  } catch (e) {
    // O disparo ja foi registrado; o que falhou aqui foi o envio. Deixa
    // rastro no log do container e devolve zero em vez de explodir.
    console.error('[supra] falha no envio dos convites:', e instanceof Error ? e.message : e)
    return { enviados: 0, falhas: 0 }
  }
}

/** Avisa os convidados de que a rodada fechou. Mesma regra: nunca lanca. */
export async function avisarEncerramento(cotacaoId: number): Promise<void> {
  try {
    const d = await dados(cotacaoId)
    if (!d) return
    const alvos = await destinatarios(cotacaoId, false)
    if (alvos.length === 0) return

    const itens: Envio[] = alvos.map((a) => {
      const m = encerramento({
        fornecedor: a.razao_social, empresa: d.c.empresa,
        numero: d.c.numero, titulo: d.c.titulo,
        respondeu: a.status === 'respondido',
      })
      return {
        para: a.email, assunto: m.assunto, texto: m.texto, html: m.html,
        tipo: 'encerramento', empresaId: d.c.empresa_id, cotacaoId: d.c.id, fornecedorId: a.fornecedor_id,
      }
    })

    await enviarLote(itens)
  } catch (e) {
    console.error('[supra] falha no aviso de encerramento:', e instanceof Error ? e.message : e)
  }
}

/**
 * Executa em segundo plano, sem prender a resposta HTTP.
 *
 * Quarenta convites levam uns vinte segundos; nenhum navegador — e nenhum
 * proxy — espera isso num POST de formulario. A pagina volta na hora e os
 * numeros aparecem conforme as entregas resolvem.
 *
 * Isso pressupoe um processo de vida longa, que e o caso: o container roda
 * o servidor Next continuamente. Em ambiente de funcao efemera, esse envio
 * teria de virar fila externa.
 */
export function emSegundoPlano(tarefa: () => Promise<unknown>): void {
  void tarefa().catch((e) => {
    console.error('[supra] tarefa em segundo plano falhou:', e instanceof Error ? e.message : e)
  })
}
