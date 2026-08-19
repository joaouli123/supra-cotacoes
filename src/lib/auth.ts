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
  // Sem segredo configurado o sistema ainda roda (desenvolvimento local), mas
  // os crachas nao sao portaveis entre instancias. Em producao defina a env.
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
