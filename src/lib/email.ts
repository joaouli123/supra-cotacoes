// =====================================================================
// Camada de e-mail: configuracao, modo de envio e registro.
//
// O `smtp.ts` fala o protocolo; este arquivo decide *se* e *para quem* a
// mensagem sai, e guarda o que aconteceu em `email_logs`.
//
// O modo existe por um motivo concreto. A base de demonstracao tem dez mil
// fornecedores com dominio inventado (zenite.com.br, ouro.preto.com.br).
// Disparar de verdade contra eles e devolucao em massa garantida, e caixa
// que recebe devolucao em massa perde reputacao — junto com todos os outros
// sistemas que mandam pelo mesmo dominio. Por isso o padrao e
// `redirecionado`: o envio acontece de verdade, pelo SMTP de verdade, mas
// tudo cai numa caixa unica com o destinatario pretendido no assunto. Quem
// operar com base real troca uma variavel de ambiente e passa para `real`.
// =====================================================================
import { executar, um } from './db'
import { entregar, ErroSmtp, type Credenciais } from './smtp'

export type Modo = 'simulado' | 'redirecionado' | 'real'
export type Estado = 'enviado' | 'falhou' | 'simulado'

export type Config = {
  /** Ha host, usuario e senha — da para tentar abrir conexao. */
  pronto: boolean
  modo: Modo
  host: string
  porta: number
  implicito: boolean
  usuario: string
  remetente: string
  nome: string
  responderPara: string
  redirecionarPara: string
  base: string
  /** O que impede o envio de funcionar como o modo escolhido pede. */
  problemas: string[]
}

const txt = (v: string | undefined, padrao = '') => (v ?? '').trim() || padrao

/**
 * Le a configuracao do ambiente a cada chamada, sem cache.
 *
 * E barato, e evita o caso irritante de trocar a variavel no painel,
 * reiniciar o container e continuar vendo o valor antigo porque alguem
 * memorizou o objeto no primeiro import.
 */
export function configuracao(): Config {
  const host = txt(process.env.SMTP_HOST)
  const porta = Number(txt(process.env.SMTP_PORTA, '465')) || 465
  const usuario = txt(process.env.SMTP_USUARIO)
  const senha = txt(process.env.SMTP_SENHA)
  const remetente = txt(process.env.SMTP_REMETENTE, usuario)
  const redirecionarPara = txt(process.env.EMAIL_REDIRECIONAR_PARA)

  const bruto = txt(process.env.EMAIL_MODO, 'redirecionado').toLowerCase()
  const modo: Modo =
    bruto === 'real' || bruto === 'simulado' || bruto === 'redirecionado' ? bruto : 'redirecionado'

  const problemas: string[] = []
  if (!host) problemas.push('SMTP_HOST não definido.')
  if (!usuario) problemas.push('SMTP_USUARIO não definido.')
  if (!senha) problemas.push('SMTP_SENHA não definida.')
  if (modo === 'redirecionado' && !redirecionarPara) {
    problemas.push('EMAIL_MODO é "redirecionado" mas EMAIL_REDIRECIONAR_PARA está vazio — nada seria entregue.')
  }
  if (!txt(process.env.APP_URL)) {
    problemas.push('APP_URL não definida — os links do portal saem relativos e não abrem no e-mail.')
  }

  return {
    pronto: Boolean(host && usuario && senha),
    modo,
    host,
    // 465 fala TLS desde o primeiro byte; 587 e 25 sobem com STARTTLS.
    porta, implicito: porta === 465,
    usuario,
    remetente,
    nome: txt(process.env.SMTP_NOME, 'SUPRA Cotações'),
    responderPara: txt(process.env.SMTP_RESPONDER_PARA),
    redirecionarPara,
    base: txt(process.env.APP_URL).replace(/\/+$/, ''),
    problemas,
  }
}

function credenciais(c: Config): Credenciais {
  return {
    host: c.host, porta: c.porta, usuario: c.usuario,
    senha: txt(process.env.SMTP_SENHA), implicito: c.implicito,
  }
}

/** Endereco plausivel. Nao valida caixa — so evita gastar conexao com lixo. */
export const enderecoValido = (e: string) => /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(e.trim())

export type Envio = {
  para: string
  assunto: string
  texto: string
  html: string
  tipo: string
  empresaId?: number | null
  cotacaoId?: number | null
  fornecedorId?: number | null
  /**
   * Ignora o modo e entrega no endereco informado.
   *
   * Reservado ao teste de configuracao, onde alguem autenticado digitou o
   * endereco a mao: redirecionar ou simular ali nao testaria nada. Envio de
   * rodada nunca marca isso — e o modo que protege a reputacao da conta
   * contra os dominios ficticios da base de demonstracao.
   */
  direto?: boolean
}

export type Resultado = {
  ok: boolean
  estado: Estado
  /** Para onde a mensagem realmente foi — difere de `para` no modo redirecionado. */
  destino: string
  erro?: string
  ms: number
}

/**
 * No modo redirecionado o destinatario original vira parte do conteudo.
 * Sem isso, dez mensagens na mesma caixa sao indistinguiveis e o teste
 * nao prova nada.
 */
function redirecionarConteudo(e: Envio, destino: string): Envio {
  const faixa =
    `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;` +
    `padding:12px 14px;margin:0 0 20px;font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#7c2d12">` +
    `<strong>Envio redirecionado.</strong> Destinatário real: <code>${escapar(e.para)}</code>. ` +
    `Esta cópia chegou aqui porque <code>EMAIL_MODO=redirecionado</code>.</div>`

  return {
    ...e,
    assunto: `[→ ${e.para}] ${e.assunto}`,
    texto:
      `[SUPRA — envio redirecionado]\n` +
      `Destinatário real: ${e.para}\n` +
      `Esta cópia chegou em ${destino} porque EMAIL_MODO=redirecionado.\n` +
      `${'—'.repeat(58)}\n\n${e.texto}`,
    // A faixa entra dentro do <body>. Colada antes do doctype ela vira
    // conteúdo solto fora do documento, e sanitizador de cliente descarta.
    html: /<body[^>]*>/i.test(e.html)
      ? e.html.replace(/<body[^>]*>/i, (tag) => tag + faixa)
      : faixa + e.html,
  }
}

const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Entrega uma mensagem e registra o desfecho.
 *
 * Nunca lanca: quem chama esta quase sempre no meio de um disparo com
 * dezenas de destinatarios, e um endereco podre nao pode derrubar a rodada
 * inteira. O erro volta no resultado e fica no log.
 */
export async function enviar(e: Envio): Promise<Resultado> {
  const t0 = Date.now()
  const c = configuracao()

  const anotar = async (r: Resultado) => { await registrar(e, c.modo, r); return r }

  if (!enderecoValido(e.para)) {
    return anotar({ ok: false, estado: 'falhou', destino: e.para, ms: Date.now() - t0,
      erro: 'Endereço de e-mail inválido no cadastro do destinatário.' })
  }

  if (c.modo === 'simulado' && !e.direto) {
    return anotar({ ok: true, estado: 'simulado', destino: e.para, ms: Date.now() - t0 })
  }
  if (!c.pronto) {
    return anotar({ ok: false, estado: 'falhou', destino: e.para, ms: Date.now() - t0,
      erro: 'SMTP não configurado: ' + c.problemas.join(' ') })
  }

  let destino = e.para
  let msg = e
  if (c.modo === 'redirecionado' && !e.direto) {
    if (!c.redirecionarPara) {
      return anotar({ ok: false, estado: 'falhou', destino: e.para, ms: Date.now() - t0,
        erro: 'EMAIL_REDIRECIONAR_PARA está vazio no modo redirecionado.' })
    }
    destino = c.redirecionarPara
    msg = redirecionarConteudo(e, destino)
  }

  // Uma repeticao, e so para recusa temporaria (4xx) ou queda de conexao.
  // 5xx e definitivo — insistir contra "caixa nao existe" e o comportamento
  // que faz provedor classificar o remetente como spam.
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      await entregar(credenciais(c), {
        de: { nome: c.nome, endereco: c.remetente },
        para: destino,
        assunto: msg.assunto,
        texto: msg.texto,
        html: msg.html,
        responderPara: c.responderPara || undefined,
      })
      return anotar({ ok: true, estado: 'enviado', destino, ms: Date.now() - t0 })
    } catch (err) {
      const erro = err instanceof Error ? err.message : String(err)
      const codigo = err instanceof ErroSmtp ? err.codigo : undefined
      const definitivo = typeof codigo === 'number' && codigo >= 500
      if (definitivo || tentativa === 2) {
        return anotar({ ok: false, estado: 'falhou', destino, ms: Date.now() - t0, erro })
      }
      await new Promise((r) => setTimeout(r, 1500))
    }
  }

  // Inalcancavel — o laco sempre retorna. Presente para o compilador.
  return anotar({ ok: false, estado: 'falhou', destino, ms: Date.now() - t0, erro: 'Falha desconhecida.' })
}

async function registrar(e: Envio, modo: Modo, r: Resultado) {
  try {
    await executar(
      `insert into email_logs
        (empresa_id, cotacao_id, fornecedor_id, tipo, para, entregue_para,
         assunto, modo, estado, erro, ms, criado_em)
       values (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [e.empresaId ?? null, e.cotacaoId ?? null, e.fornecedorId ?? null, e.tipo,
       e.para, r.destino, e.assunto.slice(0, 300), modo, r.estado,
       r.erro ? r.erro.slice(0, 500) : null, r.ms, new Date().toISOString()])
  } catch {
    // Um log que falha nao pode derrubar o envio que ele descreve. Se a
    // tabela ainda nao existe (container subiu antes da migracao), o e-mail
    // ja saiu — perder a linha e menos grave do que perder a mensagem.
  }
}

/**
 * Envia varias mensagens com concorrencia limitada.
 *
 * Serial, quarenta convites levariam uns oitenta segundos; todos de uma vez,
 * o provedor corta a conexao por excesso de sessoes simultaneas. Quatro por
 * vez fica dentro do limite da Hostinger e resolve o lote em ~20s.
 */
export async function enviarLote(
  itens: Envio[],
  aoConcluir?: (r: Resultado, e: Envio) => Promise<void> | void,
  limite = 4,
): Promise<{ enviados: number; falhas: number }> {
  let proximo = 0
  let enviados = 0
  let falhas = 0

  const trabalhador = async () => {
    for (;;) {
      const i = proximo++
      if (i >= itens.length) return
      const r = await enviar(itens[i])
      if (r.ok) enviados++
      else falhas++
      if (aoConcluir) {
        try { await aoConcluir(r, itens[i]) } catch { /* o envio ja aconteceu */ }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador))
  return { enviados, falhas }
}

/** Resumo para a tela de configuracao. */
export async function resumoEnvios(): Promise<{ total: number; enviados: number; falhas: number; ultimo: string | null }> {
  const r = await um<{ total: number; enviados: number; falhas: number; ultimo: string | null }>(
    `select count(*) total,
            sum(case when estado in ('enviado','simulado') then 1 else 0 end) enviados,
            sum(case when estado = 'falhou' then 1 else 0 end) falhas,
            max(criado_em) ultimo
       from email_logs`)
  return {
    total: Number(r?.total ?? 0),
    enviados: Number(r?.enviados ?? 0),
    falhas: Number(r?.falhas ?? 0),
    ultimo: r?.ultimo ?? null,
  }
}
