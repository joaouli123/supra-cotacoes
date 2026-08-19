// =====================================================================
// Migracao de e-mail — idempotente, roda a cada subida do container.
//
// Cria `email_logs`: uma linha por mensagem que a plataforma tentou
// entregar, com o desfecho real do SMTP.
//
// A tabela nao tem chave estrangeira de proposito. O log precisa sobreviver
// a exclusao do fornecedor ou da cotacao que o originou — e justamente
// quando alguem apaga o registro que a pergunta "essa mensagem chegou a
// sair?" costuma aparecer. As colunas de vinculo sao ponteiros frouxos.
//
//   node scripts/migrar-email.mjs
// =====================================================================
import { DatabaseSync } from 'node:sqlite'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))
const SQLITE = join(__dirname, '..', 'data', 'supra.db')

// `para` guarda o endereco pretendido e `entregue_para` o endereco que
// recebeu. No modo redirecionado os dois diferem, e e essa diferenca que
// permite auditar um teste sem confundi-lo com um envio de producao.
const TABELA = (identidade) => `
create table if not exists email_logs (
  id ${identidade},
  empresa_id integer,
  cotacao_id integer,
  fornecedor_id integer,
  tipo text not null,
  para text not null,
  entregue_para text not null,
  assunto text not null,
  modo text not null,
  estado text not null,
  erro text,
  ms integer not null,
  criado_em text not null
)`

const INDICES = [
  // a tela lista os ultimos envios em ordem decrescente
  'create index if not exists ix_email_criado on email_logs(criado_em desc)',
  // o detalhe da cotacao mostra o que saiu naquela rodada
  'create index if not exists ix_email_cotacao on email_logs(cotacao_id)',
  // o filtro de falhas e o primeiro lugar que alguem abre quando reclamam
  'create index if not exists ix_email_estado on email_logs(estado, criado_em desc)',
]

async function comPostgres(url) {
  const pg = require('pg')
  const c = new pg.Client({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })
  await c.connect()
  try {
    const antes = await c.query(
      `select count(*)::int c from information_schema.tables
        where table_schema = current_schema() and table_name = 'email_logs'`)
    await c.query(TABELA('integer generated always as identity primary key'))
    console.log(antes.rows[0].c ? '  email_logs ja existia' : '  email_logs criada')

    for (const sql of INDICES) await c.query(sql)
    await c.query('analyze email_logs')
    console.log(`  ${INDICES.length} indices garantidos`)
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
  const antes = db.prepare(
    "select count(*) c from sqlite_master where type = 'table' and name = 'email_logs'").get()
  db.exec(TABELA('integer primary key autoincrement'))
  console.log(antes.c ? '  email_logs ja existia' : '  email_logs criada')

  for (const sql of INDICES) db.exec(sql)
  db.exec('analyze email_logs')
  console.log(`  ${INDICES.length} indices garantidos`)
  db.close()
}

console.log('[supra] migracao de e-mail (email_logs)')
if (process.env.DATABASE_URL) await comPostgres(process.env.DATABASE_URL)
else comSqlite()
