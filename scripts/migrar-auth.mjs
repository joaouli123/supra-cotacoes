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

// A conta e casada por e-mail. Trocar SUPRA_ADMIN_EMAIL, sem mais nada, faria a
// busca nao achar ninguem e uma segunda conta nascer — a antiga continuaria ai,
// admin_central, com a senha antiga valendo e fora do alcance da variavel que
// deveria rotaciona-la. Entao, quando o e-mail configurado nao existe mas ja ha
// exatamente uma conta com a forma que este script cria, o certo e **renomear**
// essa conta, nao criar outra: o id se mantem, e com ele o historico de
// auditoria, que aponta para o usuario pelo id.
const FORMA_GERIDA = `perfil = 'admin_central'
      and empresa_id is null
      and fornecedor_id is null
      and senha_hash is not null`

const SQL_GERIDAS = `select id, email from usuarios where ${FORMA_GERIDA} order by id`

// Rede de seguranca para o caso ambiguo (duas ou mais contas nessa forma): nao
// da para adivinhar qual renomear, entao cria-se a nova e as demais perdem o
// login. A linha continua na base; so a senha sai.
const SQL_ORFAOS = `update usuarios set senha_hash = null
    where lower(email) <> lower(:1) and ${FORMA_GERIDA}`

function avisarOrfaos(linhas) {
  if (!linhas.length) return
  const lista = linhas.map((r) => `${r.email} (id ${r.id})`).join(', ')
  console.log(`  login revogado de ${linhas.length} conta(s) administrativa(s) orfa(s): ${lista}`)
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
    const aplicar = (id) => c.query(
      `update usuarios set email=$1, senha_hash=$2, perfil='admin_central', ativo=1,
                           empresa_id=null, fornecedor_id=null, nome=$3,
                           cargo='Administrador da Plataforma'
        where id=$4`, [EMAIL, hash, NOME, id])

    const achou = await c.query('select id from usuarios where lower(email) = lower($1) order by id limit 1', [EMAIL])
    if (achou.rows.length) {
      await aplicar(achou.rows[0].id)
      console.log(`  conta ${EMAIL} atualizada (id ${achou.rows[0].id})`)
      return
    }

    const geridas = (await c.query(SQL_GERIDAS)).rows
    if (geridas.length === 1) {
      await aplicar(geridas[0].id)
      console.log(`  conta ${geridas[0].email} renomeada para ${EMAIL} (id ${geridas[0].id})`)
      return
    }

    const novo = await c.query(
      `insert into usuarios (empresa_id, fornecedor_id, nome, email, cargo, perfil, ativo, senha_hash)
       values (null, null, $1, $2, 'Administrador da Plataforma', 'admin_central', 1, $3) returning id`,
      [NOME, EMAIL, hash])
    console.log(`  conta ${EMAIL} criada (id ${novo.rows[0].id})`)
    const orfas = await c.query(`${SQL_ORFAOS.replace(':1', '$1')} returning id, email`, [EMAIL])
    avisarOrfaos(orfas.rows)
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
  const aplicar = (id) => db.prepare(
    `update usuarios set email=?, senha_hash=?, perfil='admin_central', ativo=1,
                         empresa_id=null, fornecedor_id=null, nome=?,
                         cargo='Administrador da Plataforma'
      where id=?`).run(EMAIL, hash, NOME, id)

  const achou = db.prepare('select id from usuarios where lower(email) = lower(?) order by id limit 1').get(EMAIL)
  const geridas = db.prepare(SQL_GERIDAS).all()
  if (achou) {
    aplicar(achou.id)
    console.log(`  conta ${EMAIL} atualizada (id ${achou.id})`)
  } else if (geridas.length === 1) {
    aplicar(geridas[0].id)
    console.log(`  conta ${geridas[0].email} renomeada para ${EMAIL} (id ${geridas[0].id})`)
  } else {
    const proximo = db.prepare('select coalesce(max(id),0)+1 n from usuarios').get().n
    db.prepare(`insert into usuarios (id, empresa_id, fornecedor_id, nome, email, cargo, perfil, ativo, senha_hash)
                values (?, null, null, ?, ?, 'Administrador da Plataforma', 'admin_central', 1, ?)`)
      .run(proximo, NOME, EMAIL, hash)
    console.log(`  conta ${EMAIL} criada (id ${proximo})`)
    avisarOrfaos(db.prepare(SQL_ORFAOS.replace(':1', '?') + ' returning id, email').all(EMAIL))
  }
  db.close()
}

console.log('[supra] migracao de autenticacao')
if (process.env.DATABASE_URL) await comPostgres(process.env.DATABASE_URL)
else comSqlite()
