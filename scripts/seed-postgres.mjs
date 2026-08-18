// =====================================================================
// Carrega o PostgreSQL a partir da base local SQLite.
//
// A geracao dos dados continua sendo do seed.mjs (rapida e deterministica);
// aqui apenas aplicamos o schema no Postgres e copiamos os registros, o que
// garante que os dois motores tenham exatamente a mesma base.
//
//   DATABASE_URL=postgres://... node scripts/seed-postgres.mjs
// =====================================================================
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// A copia de 'pg' tracada pelo Next no build standalone nao publica entrada
// ESM; carregamos via require para funcionar tanto no repo quanto na imagem.
const require = createRequire(import.meta.url)
const pg = require('pg')

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(__dirname, '..')
const SQLITE = join(RAIZ, 'data', 'supra.db')
const URL_PG = process.env.DATABASE_URL

if (!URL_PG) { console.error('Defina DATABASE_URL.'); process.exit(1) }
if (!existsSync(SQLITE)) { console.error('Base local ausente. Rode "npm run seed" antes.'); process.exit(1) }

// Ordem respeitando as chaves estrangeiras
const TABELAS = [
  'empresas', 'unidades', 'classificacoes', 'usuarios', 'materiais', 'fornecedores',
  'fornecedor_grupos', 'clientes', 'transportadoras', 'demandas', 'demanda_itens',
  'cotacoes', 'cotacao_itens', 'cotacao_fornecedores', 'propostas', 'proposta_itens',
  'agendamentos', 'disparo_logs', 'erp_conectores', 'erp_eventos', 'auditoria',
]
// Colunas geradas pelo Postgres nao entram na copia
const IGNORAR = { materiais: ['busca'], fornecedores: ['busca'] }
const LOTE = 1000

const t0 = Date.now()
const passo = (m) => console.log(`  ${String((Date.now() - t0) / 1000).padStart(6)}s  ${m}`)

const lite = new DatabaseSync(SQLITE, { readOnly: true })
const cliente = new pg.Client({
  connectionString: URL_PG,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
})
await cliente.connect()
passo('conectado ao PostgreSQL')

// ---------------------------------------------------------------- schema
await cliente.query('drop schema public cascade; create schema public;')
await cliente.query(readFileSync(join(__dirname, 'schema.postgres.sql'), 'utf8'))
passo('schema aplicado')

// ---------------------------------------------------------------- copia
let total = 0
for (const tabela of TABELAS) {
  const linhas = lite.prepare(`select * from ${tabela}`).all()
  if (!linhas.length) { passo(`${tabela}: vazia`); continue }

  const ignorar = IGNORAR[tabela] ?? []
  const colunas = Object.keys(linhas[0]).filter((c) => !ignorar.includes(c))
  const temId = colunas.includes('id')
  const listaCols = colunas.map((c) => `"${c}"`).join(',')

  await cliente.query('begin')
  for (let i = 0; i < linhas.length; i += LOTE) {
    const fatia = linhas.slice(i, i + LOTE)
    const valores = []
    const marcadores = fatia.map((linha, j) => {
      const base = j * colunas.length
      colunas.forEach((c) => valores.push(linha[c]))
      return `(${colunas.map((_, k) => `$${base + k + 1}`).join(',')})`
    }).join(',')
    await cliente.query(
      `insert into ${tabela} (${listaCols}) ${temId ? 'overriding system value' : ''} values ${marcadores}`,
      valores,
    )
  }
  await cliente.query('commit')

  // realinha a sequencia de identidade com o maior id copiado
  if (temId) {
    await cliente.query(
      `select setval(pg_get_serial_sequence('${tabela}','id'), coalesce((select max(id) from ${tabela}),1))`
    )
  }
  total += linhas.length
  passo(`${tabela.padEnd(22)} ${String(linhas.length).padStart(7)} registros`)
}

await cliente.query('analyze')
passo(`concluido — ${total.toLocaleString('pt-BR')} registros copiados`)

// ------------------------------------------------------------ conferencia
console.log('\n  conferencia SQLite x PostgreSQL:')
let divergencias = 0
for (const tabela of TABELAS) {
  const a = lite.prepare(`select count(*) c from ${tabela}`).get().c
  const b = Number((await cliente.query(`select count(*) c from ${tabela}`)).rows[0].c)
  if (a !== b) { divergencias++; console.log(`   ${tabela}: ${a} x ${b}  <-- DIVERGENTE`) }
}
console.log(divergencias ? `\n  ${divergencias} tabela(s) divergente(s)` : '  todas as contagens conferem')

lite.close()
await cliente.end()
