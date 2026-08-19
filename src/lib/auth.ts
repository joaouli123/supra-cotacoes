import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * Autenticacao propria, sem dependencia externa: scrypt do node:crypto para a
 * senha e HMAC-SHA256 para o cracha da sessao. Manter zero dependencias aqui e
 * proposital — o build standalone do Next copia apenas o que e importado, e
 * qualquer pacote novo precisaria acompanhar a imagem.
 */

const CUSTO = { N: 16384, r: 8, p: 1 }
const TAMANHO_HASH = 32
const DIAS_SESSAO = 7

export const COOKIE_SESSAO = 'supra_sessao'

// ------------------------------------------------------------------ senha

export function gerarHash(senha: string): string {
  const sal = randomBytes(16)
  const hash = scryptSync(senha.normalize('NFKC'), sal, TAMANHO_HASH, CUSTO)
  return `scrypt:${sal.toString('hex')}:${hash.toString('hex')}`
}

export function conferirSenha(senha: string, guardado: string | null | undefined): boolean {
  if (!guardado) return false
  const [algoritmo, salHex, hashHex] = guardado.split(':')
  if (algoritmo !== 'scrypt' || !salHex || !hashHex) return false
  let esperado: Buffer
  try {
    esperado = Buffer.from(hashHex, 'hex')
  } catch {
    return false
  }
  if (esperado.length !== TAMANHO_HASH) return false
  const obtido = scryptSync(senha.normalize('NFKC'), Buffer.from(salHex, 'hex'), TAMANHO_HASH, CUSTO)
  return timingSafeEqual(esperado, obtido)
}

// ------------------------------------------------------------- cracha

function segredo(): string {
  const s = process.env.SUPRA_SESSAO_SECRET
  if (s && s.length >= 16) return s
  // O repositorio e publico: segredo embutido no fonte nao e segredo. Em
  // producao a falta da variavel derruba a rota, em vez de aceitar em
  // silencio crachas forjados por quem leu o codigo. Fora de producao o
  // sistema segue rodando, apenas sem crachas portaveis entre instancias.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SUPRA_SESSAO_SECRET ausente ou com menos de 16 caracteres.')
  }
  return 'supra-desenvolvimento-local-trocar-em-producao'
}

function assinar(corpo: string): string {
  return createHmac('sha256', segredo()).update(corpo).digest('base64url')
}

export function assinarCracha(idUsuario: number): string {
  const corpo = Buffer.from(
    JSON.stringify({ uid: idUsuario, exp: Date.now() + DIAS_SESSAO * 86400_000 })
  ).toString('base64url')
  return `${corpo}.${assinar(corpo)}`
}

/** Devolve o id do usuario se o cracha for autentico e estiver no prazo. */
export function lerCracha(token: string | undefined): number | null {
  if (!token) return null
  const corte = token.lastIndexOf('.')
  if (corte < 1) return null
  const corpo = token.slice(0, corte)
  const recebida = Buffer.from(token.slice(corte + 1))
  const calculada = Buffer.from(assinar(corpo))
  if (recebida.length !== calculada.length || !timingSafeEqual(recebida, calculada)) return null
  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString())
    if (typeof dados.uid !== 'number' || typeof dados.exp !== 'number') return null
    if (dados.exp < Date.now()) return null
    return dados.uid
  } catch {
    return null
  }
}

export const OPCOES_COOKIE_SESSAO = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: DIAS_SESSAO * 86400,
}

/* ------------------------------------------------ valores assinados --- */
/**
 * Assina um valor curto que precisa viajar em cookie legivel pelo cliente.
 * Usado pelo portal do fornecedor, onde a identidade nasce do token do
 * convite e nao de um login: sem assinatura, o proprio navegador escolheria
 * de qual fornecedor quer ver as cotacoes.
 */
export function assinarValor(valor: string): string {
  return `${Buffer.from(valor).toString('base64url')}.${assinar(valor)}`
}

export function lerValor(token: string | undefined): string | null {
  if (!token) return null
  const corte = token.lastIndexOf('.')
  if (corte < 1) return null
  let corpo: string
  try {
    corpo = Buffer.from(token.slice(0, corte), 'base64url').toString()
  } catch {
    return null
  }
  const recebida = Buffer.from(token.slice(corte + 1))
  const calculada = Buffer.from(assinar(corpo))
  if (recebida.length !== calculada.length || !timingSafeEqual(recebida, calculada)) return null
  return corpo
}
