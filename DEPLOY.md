# Deploy — supra.uxcodedev.com.br (Coolify)

Projeto independente. Não compartilha código, banco, servidor nem domínio com
nenhum outro sistema.

A aplicação já está pronta para o Coolify: `Dockerfile` na raiz do projeto,
saída `standalone` do Next, health check em `/api/saude` e carga automática da
base na primeira subida.

---

## Antes de começar — dados que faltam

Estes valores dependem do seu ambiente e precisam ser preenchidos:

| O quê | Onde encontrar |
|---|---|
| Endereço do painel do Coolify | a instância onde este sistema vai rodar |
| IP do servidor | painel → **Servers** → o servidor escolhido |
| Repositório Git | ver "Repositório" mais abaixo |

Sempre que aparecer `<IP_DO_SERVIDOR>` ou `<PAINEL>` neste documento, troque
pelos valores da instância de destino.

---

## 1. Banco PostgreSQL

**+ New → Database → PostgreSQL 16**

| Campo | Valor |
|---|---|
| Nome | `supra-postgres` |
| Banco | `supra` |
| Usuário | `supra` |
| Versão | 16 |

Anote a **URL interna** gerada pelo Coolify — algo como
`postgres://supra:SENHA@supra-postgres:5432/supra`. É a interna que vai na
aplicação, não a exposta publicamente.

O banco é exclusivo deste sistema. Não reaproveite instância de outro projeto:
o carregamento inicial roda `drop schema public cascade`.

## 2. Aplicação

**+ New → Application → Git**

| Campo | Valor |
|---|---|
| Repositório | `joaouli123/supra-cotacoes` |
| Branch | `main` |
| Build pack | `Dockerfile` |
| Base directory | `/` |
| Porta exposta | `3000` |
| Health check | `/api/saude` |

O projeto está na raiz do repositório, então `Base directory` é `/`.

## 3. Variáveis de ambiente

Aba **Environment Variables**:

```
DATABASE_URL=postgres://supra:SENHA@supra-postgres:5432/supra
DATABASE_SSL=false
NODE_ENV=production
```

Nenhuma é `NEXT_PUBLIC_*`, então não precisam existir em tempo de build — basta
estarem disponíveis no runtime.

## 4. Domínio

Em **Domains**, informe `https://supra.uxcodedev.com.br`.

No DNS, crie o subdomínio apontando para o servidor do Coolify:

```
A   supra   <IP_DO_SERVIDOR>   TTL 300
```

**Onde criar:** hoje `uxcodedev.com.br` é servido pela Hostinger — a resposta
traz o cabeçalho `server: hcdn` e um IPv6 da faixa `2a02:4780:…`. Então o
registro deve ser criado no painel de DNS da Hostinger, salvo se a zona tiver
sido movida. Criar o subdomínio não afeta o site principal.

Se a zona estiver atrás da Cloudflare, **deixe a nuvem cinza** (proxy desligado)
até o Let's Encrypt emitir o certificado: com o proxy ligado o desafio HTTP-01
não completa. Depois de emitido, pode religar.

Confirme a propagação antes de clicar em Deploy:

```bash
dig +short supra.uxcodedev.com.br    # deve retornar o IP do servidor
```

## 5. Deploy

Clique em **Deploy**. Na primeira subida o container:

1. detecta o PostgreSQL vazio;
2. gera a massa de demonstração (~3 s);
3. copia 179 mil registros para o PostgreSQL (~12 s);
4. sobe o servidor.

Leva de 1 a 2 minutos. O health check tem `start-period` de 90 s exatamente
para cobrir essa carga inicial.

## 6. Deploy automático

Com o repositório conectado por GitHub App, todo push na branch configurada
dispara o build. Para forçar sem commit novo, use o botão **Deploy** ou a API:

```bash
curl -X POST "https://<PAINEL>/api/v1/deploy?uuid=<UUID_DA_APLICACAO>" \
  -H "Authorization: Bearer <TOKEN>"
```

---

---

## Os dois motores de banco

O mesmo código roda em SQLite e PostgreSQL. Quem decide é `DATABASE_URL`:

| | sem `DATABASE_URL` | com `DATABASE_URL` |
|---|---|---|
| Motor | SQLite (`data/supra.db`) | PostgreSQL |
| Busca textual | FTS5 | `tsvector` + índice GIN |
| Uso | demonstração local, offline | produção |

O modelo relacional é o mesmo; muda só o dialeto, isolado em `src/lib/db.ts`.
As consultas das telas são idênticas nos dois casos.

A busca no PostgreSQL é insensível a acento: quem digita `flexivel` encontra
`FLEXÍVEL`. Usa a extensão `unaccent` envolvida numa função `IMMUTABLE`,
requisito para indexar a coluna gerada.

### Recarregar a base manualmente

```bash
npm run seed                                        # gera data/supra.db
DATABASE_URL=postgres://... npm run seed:postgres   # recria o schema e copia
```

`seed:postgres` **apaga e recria o schema** (`drop schema public cascade`). Não
rode contra um banco que precise ser preservado.

Para subir sem carregar dados, defina `SUPRA_SEED_ON_BOOT=false`.

---

## Verificação depois do deploy

```bash
curl https://supra.uxcodedev.com.br/api/saude
# {"estado":"ok","motor":"postgresql","empresas":8,"latencia_ms":3}
```

Responde 503 se o banco estiver inacessível ou vazio, o que faz o health check
reiniciar o container em vez de servir tela quebrada.

---

## O que já foi validado localmente

Contra um PostgreSQL 16 real:

- schema aplicado sem erro (21 tabelas)
- 179.450 registros copiados, contagens conferindo contra o SQLite
- 6 perfis de acesso × 17 rotas, todas HTTP 200
- busca textual com e sem acento
- envio de proposta pelo portal: transação, id gerado por sequência, itens
  gravados e a proposta entrando na equalização
- servidor `standalone` subindo pelo mesmo entrypoint do container
- primeira subida com banco vazio: carga automática e health check `ok`
