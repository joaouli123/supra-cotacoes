#!/bin/sh
# Prepara a base na primeira subida e entrega o controle ao servidor.
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[supra] PostgreSQL configurado."

  # Sonda de estado da base. Imprime exatamente uma palavra:
  #   VAZIA        conectou e nao ha dados
  #   CHEIA:<n>    conectou e ja existem n empresas
  #   ERRO         nao conseguiu conectar dentro das tentativas
  #
  # A distincao importa: o seed do Postgres roda "drop schema public cascade".
  # Tratar falha de conexao como "base vazia" apagaria a base de producao a
  # cada deploy — por isso ERRO interrompe a subida em vez de carregar.
  ESTADO=$(node -e "
    const pg = require('pg');
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      for (let tentativa = 1; tentativa <= 10; tentativa++) {
        const c = new pg.Client({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
          connectionTimeoutMillis: 5000,
        });
        try {
          await c.connect();
          const t = await c.query(\"select count(*)::int c from information_schema.tables where table_schema='public' and table_name='empresas'\");
          const n = t.rows[0].c ? (await c.query('select count(*)::int c from empresas')).rows[0].c : 0;
          await c.end();
          console.log(n > 0 ? 'CHEIA:' + n : 'VAZIA');
          return;
        } catch (e) {
          try { await c.end(); } catch {}
          process.stderr.write('[supra] postgres indisponivel (' + tentativa + '/10): ' + e.message + '\n');
          await espera(3000);
        }
      }
      console.log('ERRO');
    })();
  ") || ESTADO=ERRO

  case "$ESTADO" in
    ERRO|'')
      echo "[supra] Nao foi possivel falar com o PostgreSQL. Abortando para nao arriscar a base."
      exit 1
      ;;
    CHEIA:*)
      echo "[supra] Base ja contem ${ESTADO#CHEIA:} empresas — carga ignorada."
      ;;
    VAZIA)
      if [ "$SUPRA_SEED_ON_BOOT" = "false" ]; then
        echo "[supra] Base vazia, mas SUPRA_SEED_ON_BOOT=false — seguindo sem carregar."
      else
        echo "[supra] Base vazia. Gerando a massa de demonstração..."
        node --no-warnings scripts/seed.mjs
        echo "[supra] Copiando para o PostgreSQL..."
        node --no-warnings scripts/seed-postgres.mjs
        echo "[supra] Base pronta."
      fi
      ;;
  esac
else
  echo "[supra] Sem DATABASE_URL: usando SQLite local."
  if [ ! -f data/supra.db ]; then
    echo "[supra] Gerando data/supra.db..."
    node --no-warnings scripts/seed.mjs
  fi
fi

# Idempotentes, aplicados por cima da base existente a cada subida.
# Nenhum dos tres apaga dado: o primeiro garante a coluna de senha e a conta
# administrativa; o segundo troca tokens fracos do portal, cria os indices que
# faltavam e atualiza as estatisticas do planejador; o terceiro cria a tabela
# que registra cada e-mail que a plataforma tentou entregar.
node --no-warnings scripts/migrar-auth.mjs
node --no-warnings scripts/migrar-base.mjs
node --no-warnings scripts/migrar-email.mjs

exec "$@"
