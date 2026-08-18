#!/bin/sh
# Prepara a base na primeira subida e entrega o controle ao servidor.
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "[supra] PostgreSQL configurado."

  JA_TEM=$(node -e "
    const pg=require('pg');
    const c=new pg.Client({connectionString:process.env.DATABASE_URL,
      ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:false}:undefined});
    c.connect()
      .then(()=>c.query(\"select count(*)::int c from information_schema.tables where table_schema='public' and table_name='empresas'\"))
      .then(r=>c.query(r.rows[0].c?'select count(*)::int c from empresas':'select 0 c'))
      .then(r=>{console.log(r.rows[0].c);return c.end()})
      .catch(()=>{console.log('0');process.exit(0)});
  " 2>/dev/null || echo 0)

  if [ "$JA_TEM" = "0" ] || [ -z "$JA_TEM" ]; then
    if [ "$SUPRA_SEED_ON_BOOT" = "false" ]; then
      echo "[supra] Base vazia, mas SUPRA_SEED_ON_BOOT=false — seguindo sem carregar."
    else
      echo "[supra] Base vazia. Gerando a massa de demonstração..."
      node --no-warnings scripts/seed.mjs
      echo "[supra] Copiando para o PostgreSQL..."
      node --no-warnings scripts/seed-postgres.mjs
      echo "[supra] Base pronta."
    fi
  else
    echo "[supra] Base já contém $JA_TEM empresas — carga ignorada."
  fi
else
  echo "[supra] Sem DATABASE_URL: usando SQLite local."
  if [ ! -f data/supra.db ]; then
    echo "[supra] Gerando data/supra.db..."
    node --no-warnings scripts/seed.mjs
  fi
fi

exec "$@"
