// =====================================================================
// Cliente SMTP.
//
// Escrito a mao sobre `node:tls` em vez de trazer o nodemailer. O projeto
// inteiro se sustenta em quatro dependencias de runtime, e o que precisamos
// aqui e o SMTP basico do RFC 5321: EHLO, AUTH, MAIL FROM, RCPT TO, DATA.
// Sao ~120 linhas contra uma arvore de dezenas de pacotes que ninguem desta
// equipe vai auditar.
//
// O que ele NAO faz, de proposito: pool de conexoes, fila com retentativa,
// anexo, DKIM. Uma conexao por mensagem, e o resultado sobe para quem chamou
// decidir o que fazer. Se um dia a operacao exigir fila de verdade, o lugar
// de trocar e aqui dentro — quem chama so conhece `entregar()`.
// =====================================================================
import { connect as tls, type TLSSocket } from 'node:tls'
import { connect as tcp, type Socket } from 'node:net'
import { randomBytes } from 'node:crypto'

export type Credenciais = {
  host: string
  porta: number
  usuario: string
  senha: string
  /** 465 fala TLS desde o primeiro byte; 587 e 25 comecam limpo e sobem com STARTTLS. */
  implicito: boolean
}

export type Endereco = { nome: string; endereco: string }

export type Mensagem = {
  de: Endereco
  para: string
  assunto: string
  texto: string
  html: string
  responderPara?: string
}

/** Erro de SMTP com o codigo devolvido pelo servidor, quando houve um. */
export class ErroSmtp extends Error {
  codigo?: number
  constructor(mensagem: string, codigo?: number) {
    super(mensagem)
    this.name = 'ErroSmtp'
    this.codigo = codigo
  }
}

type Resposta = { codigo: number; linhas: string[] }

const LIMITE_MS = 20_000

class Sessao {
  private buf = ''
  private pendente: { ok: (r: Resposta) => void; falha: (e: Error) => void } | null = null
  private morta: Error | null = null

  private sock: Socket | TLSSocket

  constructor(sock: Socket | TLSSocket) {
    this.sock = sock
    sock.setEncoding('utf8')
    sock.on('data', (d: string) => { this.buf += d; this.despachar() })
    sock.on('error', (e: Error) => this.matar(e))
    sock.on('close', () => this.matar(new ErroSmtp('Conexão encerrada pelo servidor.')))
  }

  private matar(e: Error) {
    this.morta ??= e
    this.pendente?.falha(e)
    this.pendente = null
  }

  /**
   * Uma resposta pode ocupar varias linhas: as intermediarias trazem hifen
   * depois do codigo (`250-PIPELINING`) e so a ultima traz espaco (`250 OK`).
   * Sem essa distincao, o EHLO de qualquer servidor moderno seria lido como
   * varias respostas soltas e todo o dialogo sairia defasado em um passo.
   */
  private consumir(): Resposta | null {
    let i = 0
    const linhas: string[] = []
    for (;;) {
      const fim = this.buf.indexOf('\r\n', i)
      if (fim < 0) return null
      const linha = this.buf.slice(i, fim)
      linhas.push(linha)
      i = fim + 2
      if (/^\d{3}(?: |$)/.test(linha)) {
        this.buf = this.buf.slice(i)
        return { codigo: Number(linha.slice(0, 3)), linhas }
      }
    }
  }

  private despachar() {
    if (!this.pendente) return
    const r = this.consumir()
    if (!r) return
    const p = this.pendente
    this.pendente = null
    p.ok(r)
  }

  ler(): Promise<Resposta> {
    if (this.morta) return Promise.reject(this.morta)
    return new Promise((ok, falha) => {
      const relogio = setTimeout(
        () => this.matar(new ErroSmtp('O servidor não respondeu a tempo.')), LIMITE_MS)
      this.pendente = {
        ok: (r) => { clearTimeout(relogio); ok(r) },
        falha: (e) => { clearTimeout(relogio); falha(e) },
      }
      this.despachar()
    })
  }

  escrever(linha: string) { this.sock.write(linha + '\r\n') }

  /** Manda o comando e exige um dos codigos esperados. */
  async comando(linha: string, esperados: number[], rotulo: string): Promise<Resposta> {
    this.escrever(linha)
    const r = await this.ler()
    if (!esperados.includes(r.codigo)) {
      throw new ErroSmtp(`${rotulo}: ${r.linhas.join(' ')}`, r.codigo)
    }
    return r
  }

  trocarSocket(s: TLSSocket) {
    this.sock.removeAllListeners()
    this.sock = s
    this.buf = ''
    s.setEncoding('utf8')
    s.on('data', (d: string) => { this.buf += d; this.despachar() })
    s.on('error', (e: Error) => this.matar(e))
    s.on('close', () => this.matar(new ErroSmtp('Conexão encerrada pelo servidor.')))
  }

  encerrar() { try { this.sock.end() } catch { /* já caiu */ } }
}

function abrir(cred: Credenciais): Promise<Socket | TLSSocket> {
  return new Promise((ok, falha) => {
    const relogio = setTimeout(
      () => { s.destroy(); falha(new ErroSmtp(`Sem resposta de ${cred.host}:${cred.porta}.`)) },
      LIMITE_MS)
    const pronto = () => { clearTimeout(relogio); ok(s) }
    const s = cred.implicito
      ? tls({ host: cred.host, port: cred.porta, servername: cred.host }, pronto)
      : tcp({ host: cred.host, port: cred.porta }, pronto)
    s.once('error', (e: Error) => { clearTimeout(relogio); falha(e) })
  })
}

function subirTls(bruto: Socket, host: string): Promise<TLSSocket> {
  return new Promise((ok, falha) => {
    const s = tls({ socket: bruto, servername: host }, () => ok(s))
    s.once('error', falha)
  })
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64')

/** Cabecalho com acento precisa virar palavra codificada — RFC 2047. */
function cabecalho(valor: string): string {
  // eslint-disable-next-line no-control-regex
  if (!/[^\x00-\x7F]/.test(valor)) return valor
  return `=?UTF-8?B?${b64(valor)}?=`
}

const enderecoCompleto = (e: Endereco) =>
  e.nome ? `${cabecalho(e.nome)} <${e.endereco}>` : e.endereco

/** Quebra o base64 em linhas de 76 — acima de 998 o servidor pode recusar. */
const dobrar = (s: string) => (s.match(/.{1,76}/g) ?? []).join('\r\n')

function montar(m: Mensagem): string {
  const limite = `supra_${randomBytes(12).toString('hex')}`
  const h = [
    `From: ${enderecoCompleto(m.de)}`,
    `To: ${m.para}`,
    m.responderPara ? `Reply-To: ${m.responderPara}` : null,
    `Subject: ${cabecalho(m.assunto)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomBytes(16).toString('hex')}@${m.de.endereco.split('@')[1]}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${limite}"`,
  ].filter(Boolean)

  // Alternativa: o cliente escolhe. Texto primeiro, HTML depois — a ordem e
  // significativa, o leitor exibe a ultima parte que consegue renderizar.
  const corpo = [
    '',
    `--${limite}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    dobrar(b64(m.texto)),
    `--${limite}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    dobrar(b64(m.html)),
    `--${limite}--`,
    '',
  ]
  return [...h, ...corpo].join('\r\n')
}

/**
 * Entrega uma mensagem. Resolve em sucesso; lanca `ErroSmtp` em qualquer
 * recusa do servidor. Uma conexao por chamada.
 */
export async function entregar(cred: Credenciais, m: Mensagem): Promise<void> {
  const bruto = await abrir(cred)
  const s = new Sessao(bruto)
  const dominio = m.de.endereco.split('@')[1] || 'localhost'

  try {
    const abertura = await s.ler()
    if (abertura.codigo !== 220) {
      throw new ErroSmtp(`Servidor recusou a conexão: ${abertura.linhas.join(' ')}`, abertura.codigo)
    }

    let ehlo = await s.comando(`EHLO ${dominio}`, [250], 'EHLO')

    if (!cred.implicito) {
      // Sem TLS a senha viajaria em texto puro no primeiro AUTH. Se o servidor
      // nao oferece STARTTLS, a resposta certa e desistir, nao seguir em claro.
      if (!ehlo.linhas.some((l) => /STARTTLS/i.test(l))) {
        throw new ErroSmtp('O servidor não oferece STARTTLS e a senha não pode trafegar aberta.')
      }
      await s.comando('STARTTLS', [220], 'STARTTLS')
      s.trocarSocket(await subirTls(bruto as Socket, cred.host))
      ehlo = await s.comando(`EHLO ${dominio}`, [250], 'EHLO')
    }

    const anuncio = ehlo.linhas.join(' ').toUpperCase()
    if (anuncio.includes('AUTH') && anuncio.includes('PLAIN')) {
      await s.comando(
        `AUTH PLAIN ${b64(`\0${cred.usuario}\0${cred.senha}`)}`, [235], 'Autenticação')
    } else {
      await s.comando('AUTH LOGIN', [334], 'Autenticação')
      await s.comando(b64(cred.usuario), [334], 'Usuário')
      await s.comando(b64(cred.senha), [235], 'Senha')
    }

    await s.comando(`MAIL FROM:<${m.de.endereco}>`, [250], 'Remetente')
    await s.comando(`RCPT TO:<${m.para}>`, [250, 251], 'Destinatário')
    await s.comando('DATA', [354], 'DATA')

    // O ponto sozinho encerra o corpo; um ponto no inicio de linha do conteudo
    // precisa virar dois, senao o texto trunca ali. RFC 5321, 4.5.2.
    s.escrever(montar(m).replace(/\r\n\./g, '\r\n..'))
    s.escrever('.')
    const r = await s.ler()
    if (r.codigo !== 250) {
      throw new ErroSmtp(`Mensagem recusada: ${r.linhas.join(' ')}`, r.codigo)
    }

    try { await s.comando('QUIT', [221], 'QUIT') } catch { /* já entregou */ }
  } finally {
    s.encerrar()
  }
}
