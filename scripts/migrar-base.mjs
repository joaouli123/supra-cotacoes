// =====================================================================
// Migracao de base — idempotente, roda a cada subida do container.
//
//   1. troca os tokens fracos do portal por tokens aleatorios de verdade;
//   2. cria os indices que faltavam para as consultas de lista;
//   3. atualiza as estatisticas do planejador (analyze).
//
// Os dois primeiros passos sao guardados por condicao: na segunda subida nao
// encontram nada para fazer e saem em silencio. Nenhum passo apaga dado.
//
//   node scripts/migrar-base.mjs
// =====================================================================
import { DatabaseSync } from 'node:sqlite'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const SQLITE = join(__dirname, '..', 'data', 'supra.db')

// O token do convite e a unica credencial do portal do fornecedor: quem o tem
// enxerga a cotacao e envia proposta em nome da empresa. O da carga inicial
// nascia do gerador pseudoaleatorio do seed, que usa semente fixa e esta num
// repositorio publico — qualquer pessoa poderia recalcular todos. Estes aqui
// vem de randomBytes: 192 bits, sem relacao com o conteudo do repositorio.
const TOKEN_FRACO = "token !~ '^[A-Za-z0-9_-]{32,}$'"
const novoToken = () => randomBytes(24).toString('base64url')

const INDICES = [
  // lista de materiais: `where ativo = 1 ... order by codigo limit 40`
  'create index if not exists ix_mat_ativo_codigo on materiais(codigo) where ativo = 1',
  // lista de fornecedores: `where ativo = 1 ... order by razao_social`
  'create index if not exists ix_forn_ativo_razao on fornecedores(razao_social) where ativo = 1',
  // paginacao da auditoria: filtra por empresa e ordena por data decrescente
  'create index if not exists ix_aud_empresa_data on auditoria(empresa_id, criado_em desc)',
  'create index if not exists ix_cot_empresa_criado on cotacoes(empresa_id, criado_em desc)',
  'create index if not exists ix_dem_empresa_criado on demandas(empresa_id, criado_em desc)',
  // detalhe da cotacao lia disparo_logs sem indice pela cotacao
  'create index if not exists ix_disp_cotacao on disparo_logs(cotacao_id)',
  // ficha do fornecedor lista os grupos que ele atende
  'create index if not exists ix_fg_forn on fornecedor_grupos(fornecedor_id)',
  // filtro por grupo na lista de fornecedores (exists correlacionado)
  'create index if not exists ix_fg_class_forn on fornecedor_grupos(classificacao_id, fornecedor_id)',
]

const TABELAS = [
  'materiais', 'fornecedores', 'clientes', 'transportadoras', 'classificacoes',
  'cotacoes', 'cotacao_itens', 'cotacao_fornecedores', 'propostas', 'proposta_itens',
  'demandas', 'demanda_itens', 'auditoria', 'disparo_logs', 'usuarios', 'fornecedor_grupos',
]

async function comPostgres(url) {
  const pg = require('pg')
  const c = new pg.Client({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })
  await c.connect()
  try {
    // ---- 1. tokens do portal
    const alvo = await c.query(
      `select id from cotacao_fornecedores where ${TOKEN_FRACO} order by id`)
    if (alvo.rows.length) {
      await c.query('begin')
      try {
        for (const { id } of alvo.rows) {
          await c.query('update cotacao_fornecedores set token = $1 where id = $2', [novoToken(), id])
        }
        await c.query('commit')
      } catch (e) {
        await c.query('rollback')
        throw e
      }
      console.log(`  ${alvo.rows.length} tokens de convite regerados`)
    } else {
      console.log('  tokens de convite ja estao no formato forte')
    }

    // ---- 2. indices
    let criados = 0
    for (const sql of INDICES) {
      const antes = await c.query(
        'select count(*)::int c from pg_indexes where schemaname = current_schema() and indexname = $1',
        [sql.match(/if not exists (\w+)/)[1]])
      await c.query(sql)
      if (!antes.rows[0].c) criados += 1
    }
    console.log(criados ? `  ${criados} indices criados` : '  indices ja existiam')

    // ---- 3. estatisticas
    for (const t of TABELAS) await c.query(`analyze ${t}`)
    console.log(`  estatisticas atualizadas (${TABELAS.length} tabelas)`)
  } finally {
    await c.end()
  }
}

function comSqlite() {
  if (!existsSync(SQLITE)) {
    console.log('  base local ausente — nada a migrar')
    return
  }
  const db = new DatabaseSync(SQLITE)

  const alvo = db.prepare(
    `select id from cotacao_fornecedores
      where token is null or length(token) < 32 or token glob '*[^A-Za-z0-9_-]*'`).all()
  if (alvo.length) {
    db.exec('begin')
    try {
      const st = db.prepare('update cotacao_fornecedores set token = ? where id = ?')
      for (const { id } of alvo) st.run(novoToken(), id)
      db.exec('commit')
    } catch (e) {
      db.exec('rollback')
      throw e
    }
    console.log(`  ${alvo.length} tokens de convite regerados`)
  } else {
    console.log('  tokens de convite ja estao no formato forte')
  }

  for (const sql of INDICES) db.exec(sql)
  db.exec('analyze')
  console.log(`  ${INDICES.length} indices garantidos e estatisticas atualizadas`)
  db.close()
}

console.log('[supra] migracao de base (tokens, indices, estatisticas)')
if (process.env.DATABASE_URL) await comPostgres(process.env.DATABASE_URL)
else comSqlite()
