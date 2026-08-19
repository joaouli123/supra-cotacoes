// =====================================================================
// Migracao de autenticacao — idempotente, roda a cada subida do container.
//
//   1. garante a coluna usuarios.senha_hash (nos dois motores);
//   2. cria/atualiza a conta administrativa vinda das variaveis
//      SUPRA_ADMIN_EMAIL e SUPRA_ADMIN_SENHA.
//
// Idempotente de proposito: a base de producao ja esta populada e nao pode ser
// recarregada, entao a conta de acesso precisa ser aplicada por cima do que ja
// existe, em toda subida, sem duplicar nada.
//
//   SUPRA_ADMIN_EMAIL=... SUPRA_ADMIN_SENHA=... node scripts/migrar-auth.mjs
// =====================================================================
import { DatabaseSync } from 'node:sqlite'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { randomBytes, scryptSync } from 'node:crypto'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const SQLITE = join(__dirname, '..', 'data', 'supra.db')

// Espelha gerarHash() de src/lib/auth.ts — mesmo formato e mesmo custo.
// Se um dos dois mudar, o outro precisa mudar junto.
const CUSTO = { N: 16384, r: 8, p: 1 }
function gerarHash(senha) {
  const sal = randomBytes(16)
  const hash = scryptSync(senha.normalize('NFKC'), sal, 32, CUSTO)
  return `scrypt:${sal.toString('hex')}:${hash.toString('hex')}`
}

const EMAIL = (process.env.SUPRA_ADMIN_EMAIL || '').trim()
const SENHA = process.env.SUPRA_ADMIN_SENHA || ''
const NOME = (process.env.SUPRA_ADMIN_NOME || 'Administrador SUPRA').trim()

// Trocar SUPRA_ADMIN_EMAIL nao renomeia a conta antiga: a busca acima e por
// e-mail, entao o e-mail novo simplesmente nao acha nada e uma segunda conta
// nasce. A primeira continuaria ai, admin_central, com a senha antiga valendo —
// uma conta de administrador que ninguem lembra que existe. Aqui ela perde a
// senha e para de logar. O filtro descreve exatamente o que este script cria
// (admin da plataforma, sem empresa e sem fornecedor); conta de gente comum
// nao se encaixa e nao e tocada.
const SQL_ORFAOS = `update usuarios set senha_hash = null
    where lower(email) <> lower(:1)
      and senha_hash is not null
      and perfil = 'admin_central'
      and empresa_id is null
      and fornecedor_id is null`

function avisar(linhas) {
  if (!linhas.length) return
  const lista = linhas.map((r) => `${r.email} (id ${r.id})`).join(', ')
  console.log(`  login revogado de ${linhas.length} conta(s) administrativa(s) orfa(s): ${lista}`)
}

async function revogarOrfaos(consultar, marcador) {
  const linhas = await consultar(
    `${SQL_ORFAOS.replace(':1', marcador)} returning id, email`,
    [EMAIL]
  )
  avisar(linhas)
}

function revogarOrfaosSync(db) {
  const linhas = db.prepare(SQL_ORFAOS.replace(':1', '?') + ' returning id, email').all(EMAIL)
  avisar(linhas)
}

async function comPostgres(url) {
  const pg = require('pg')
  const c = new pg.Client({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })
  await c.connect()
  try {
    await c.query('alter table usuarios add column if not exists senha_hash text')
    await c.query('create unique index if not exists ux_usuarios_email_login on usuarios (lower(email)) where senha_hash is not null')
    console.log('  coluna senha_hash garantida')
    if (!EMAIL || !SENHA) {
      console.log('  SUPRA_ADMIN_EMAIL/SUPRA_ADMIN_SENHA nao definidas — nenhuma conta aplicada')
      return
    }
    const hash = gerarHash(SENHA)
    const achou = await c.query('select id from usuarios where lower(email) = lower($1) order by id limit 1', [EMAIL])
    if (achou.rows.length) {
      await c.query(
        `update usuarios set senha_hash=$1, perfil='admin_central', ativo=1, empresa_id=null,
                             fornecedor_id=null, nome=$2, cargo='Administrador da Plataforma'
          where id=$3`, [hash, NOME, achou.rows[0].id])
      console.log(`  conta ${EMAIL} atualizada (id ${achou.rows[0].id})`)
    } else {
      const novo = await c.query(
        `insert into usuarios (empresa_id, fornecedor_id, nome, email, cargo, perfil, ativo, senha_hash)
         values (null, null, $1, $2, 'Administrador da Plataforma', 'admin_central', 1, $3) returning id`,
        [NOME, EMAIL, hash])
      console.log(`  conta ${EMAIL} criada (id ${novo.rows[0].id})`)
    }
    await revogarOrfaos(
      (sql, ps) => c.query(sql, ps).then((r) => r.rows),
      '$1'
    )
  } finally {
    await c.end()
  }
}

function comSqlite() {
  if (!existsSync(SQLITE)) { console.log('  base SQLite ausente — nada a migrar'); return }
  const db = new DatabaseSync(SQLITE)
  const colunas = db.prepare('pragma table_info(usuarios)').all().map((c) => c.name)
  if (!colunas.includes('senha_hash')) db.exec('alter table usuarios add column senha_hash text')
  console.log('  coluna senha_hash garantida')
  if (!EMAIL || !SENHA) {
    console.log('  SUPRA_ADMIN_EMAIL/SUPRA_ADMIN_SENHA nao definidas — nenhuma conta aplicada')
    db.close(); return
  }
  const hash = gerarHash(SENHA)
  const achou = db.prepare('select id from usuarios where lower(email) = lower(?) order by id limit 1').get(EMAIL)
  if (achou) {
    db.prepare(`update usuarios set senha_hash=?, perfil='admin_central', ativo=1, empresa_id=null,
                                    fornecedor_id=null, nome=?, cargo='Administrador da Plataforma'
                 where id=?`).run(hash, NOME, achou.id)
    console.log(`  conta ${EMAIL} atualizada (id ${achou.id})`)
  } else {
    const proximo = db.prepare('select coalesce(max(id),0)+1 n from usuarios').get().n
    db.prepare(`insert into usuarios (id, empresa_id, fornecedor_id, nome, email, cargo, perfil, ativo, senha_hash)
                values (?, null, null, ?, ?, 'Administrador da Plataforma', 'admin_central', 1, ?)`)
      .run(proximo, NOME, EMAIL, hash)
    console.log(`  conta ${EMAIL} criada (id ${proximo})`)
  }
  revogarOrfaosSync(db)
  db.close()
}

console.log('[supra] migracao de autenticacao')
if (process.env.DATABASE_URL) await comPostgres(process.env.DATABASE_URL)
else comSqlite()
