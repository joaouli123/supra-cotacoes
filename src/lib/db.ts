// =====================================================================
// Acesso a dados com dois motores:
//
//   - PostgreSQL  quando DATABASE_URL esta definida (producao / Coolify)
//   - SQLite      caso contrario (demonstracao local, sem servidor de banco)
//
// O modelo relacional e as consultas sao os mesmos. Muda apenas o dialeto:
// marcadores de parametro e a sintaxe de busca textual, ambos isolados aqui.
// =====================================================================
import { join } from 'node:path'
import { existsSync } from 'node:fs'

export type Params = Array<string | number | null>

const URL_PG = process.env.DATABASE_URL?.trim() || ''
export const ehPostgres = () => URL_PG.length > 0

/* ------------------------------------------------------------ SQLite */
let _sqlite: import('node:sqlite').DatabaseSync | null = null

function sqlite() {
  if (_sqlite) return _sqlite
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
  const caminho = join(process.cwd(), 'data', 'supra.db')
  if (!existsSync(caminho)) {
    throw new Error(
      'Base local não encontrada em data/supra.db. Rode "npm run seed" ou defina DATABASE_URL para usar PostgreSQL.'
    )
  }
  _sqlite = new DatabaseSync(caminho)
  _sqlite.exec('pragma foreign_keys = on')
  return _sqlite
}

/* -------------------------------------------------------- PostgreSQL */
let _pool: import('pg').Pool | null = null

function pool() {
  if (_pool) return _pool
  const { Pool } = require('pg') as typeof import('pg')
  _pool = new Pool({
    connectionString: URL_PG,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Coolify entrega Postgres na rede interna, sem TLS
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })
  return _pool
}

/** Converte os marcadores `?` do SQLite para `$1, $2, …` do PostgreSQL. */
function paraPg(sql: string): string {
  let n = 0
  return sql.replace(/\?/g, () => `$${++n}`)
}

/* ----------------------------------------------------------- API ---- */
export async function todos<T = Record<string, unknown>>(sql: string, params: Params = []): Promise<T[]> {
  if (ehPostgres()) {
    const r = await pool().query(paraPg(sql), params)
    return r.rows as T[]
  }
  return sqlite().prepare(sql).all(...params) as T[]
}

export async function um<T = Record<string, unknown>>(sql: string, params: Params = []): Promise<T | undefined> {
  if (ehPostgres()) {
    const r = await pool().query(paraPg(sql), params)
    return r.rows[0] as T | undefined
  }
  return sqlite().prepare(sql).get(...params) as T | undefined
}

export async function contar(sql: string, params: Params = []): Promise<number> {
  const r = await um<{ c: number | string }>(sql, params)
  return r ? Number(r.c) : 0
}

export async function executar(sql: string, params: Params = []) {
  if (ehPostgres()) return pool().query(paraPg(sql), params)
  return sqlite().prepare(sql).run(...params)
}

/** Insere e devolve a chave gerada, nos dois motores. */
export async function inserirRetornandoId(sql: string, params: Params = []): Promise<number> {
  if (ehPostgres()) {
    const r = await pool().query(paraPg(`${sql} returning id`), params)
    return Number(r.rows[0].id)
  }
  const r = sqlite().prepare(sql).run(...params)
  return Number(r.lastInsertRowid)
}

export async function transacao<T>(fn: () => Promise<T>): Promise<T> {
  if (ehPostgres()) {
    const c = await pool().connect()
    try {
      await c.query('begin')
      // As escritas de dentro de fn usam o pool; para o volume desta aplicacao
      // (uma proposta por vez) a transacao de sessao e suficiente.
      const r = await fn()
      await c.query('commit')
      return r
    } catch (e) {
      await c.query('rollback').catch(() => {})
      throw e
    } finally {
      c.release()
    }
  }
  const d = sqlite()
  d.exec('begin')
  try { const r = await fn(); d.exec('commit'); return r }
  catch (e) { d.exec('rollback'); throw e }
}

/* ------------------------------------------------------ busca textual */
/** Normaliza a entrada em tokens de pelo menos duas letras. */
function tokens(entrada: string): string[] {
  return entrada
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/["'()*:^&|!<>\\-]/g, ' ')
    .split(/\s+/).filter((t) => t.length >= 2)
}

/** Sintaxe MATCH do FTS5, com prefixo em cada token. */
export function termoFts(entrada: string): string | null {
  const t = tokens(entrada)
  return t.length ? t.map((x) => `"${x}"*`).join(' AND ') : null
}

/** Sintaxe tsquery do PostgreSQL, com prefixo em cada token. */
export function termoTsquery(entrada: string): string | null {
  const t = tokens(entrada)
  return t.length ? t.map((x) => `${x}:*`).join(' & ') : null
}

export type Busca = { juncao: string; condicao: string; params: Params }

/**
 * Predicado de busca textual para a tabela indicada, no dialeto do motor ativo.
 * `alias` e o apelido da tabela na consulta (ex.: `m` para materiais).
 */
export function buscaTextual(tabela: 'materiais' | 'fornecedores', alias: string, entrada: string): Busca {
  const vazio: Busca = { juncao: '', condicao: '', params: [] }
  if (!entrada.trim()) return vazio

  if (ehPostgres()) {
    const q = termoTsquery(entrada)
    if (!q) return vazio
    return { juncao: '', condicao: `${alias}.busca @@ to_tsquery('portuguese', ?)`, params: [q] }
  }

  const q = termoFts(entrada)
  if (!q) return vazio
  const fts = `${tabela}_fts`
  const apelido = tabela === 'materiais' ? 'f_fts' : 'x_fts'
  return {
    juncao: `join ${fts} ${apelido} on ${apelido}.rowid = ${alias}.id`,
    condicao: `${fts} match ?`,
    params: [q],
  }
}
