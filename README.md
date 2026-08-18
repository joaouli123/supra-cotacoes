# SUPRA — Plataforma de Cotações Corporativas

Sistema demonstrativo funcional, construído para comprovar capacidade técnica de
entrega do Sistema de Compras especificado no levantamento do cliente.

Não é maquete de tela nem protótipo navegável: a aplicação executa consultas reais
sobre uma base carregada com os volumes informados, o portal externo grava proposta
de verdade, e a equalização é calculada em tempo de execução a cada acesso.

**Os dados são sintéticos**, gerados por script para a demonstração. Ver
"Como apresentar com honestidade" ao final.

---

## Executar

Requisito único: **Node.js 22 ou superior** (usa o módulo `node:sqlite` embutido —
não há dependência nativa para compilar).

```bash
npm install     # instala Next.js e React
npm run seed    # gera a base demonstrativa (~3 s, cria data/supra.db com 46 MB)
npm run build
npm start       # http://localhost:3010
```

Durante o desenvolvimento, `npm run dev` no lugar de `build` + `start`.

Para restaurar a base ao estado original a qualquer momento (por exemplo, depois
de enviar propostas durante um ensaio), basta rodar `npm run seed` de novo.

### Banco de dados

O mesmo código roda em dois motores, decidido pela variável `DATABASE_URL`:

| | sem `DATABASE_URL` | com `DATABASE_URL` |
|---|---|---|
| Motor | SQLite (`data/supra.db`) | PostgreSQL |
| Busca textual | FTS5 | `tsvector` + GIN, insensível a acento |
| Uso | demonstração local, offline | produção |

O modelo relacional é idêntico; muda apenas o dialeto, isolado em
`src/lib/db.ts`. Para carregar um PostgreSQL:

```bash
npm run seed                                       # gera a base local
DATABASE_URL=postgres://... npm run seed:postgres  # cria o schema e copia
```

Deploy no Coolify: ver [`DEPLOY.md`](./DEPLOY.md).

### Volumes carregados

| Entidade | Registros |
|---|---:|
| Materiais | 100.000 |
| Fornecedores | 10.000 |
| Clientes | 1.000 |
| Transportadoras | 3.000 |
| Nós de classificação (5 níveis) | 1.810 |
| Empresas (inquilinos) | 8 |
| Usuários | ~870, sendo ~240 compradores |
| Cotações históricas | 220 |
| Itens de proposta equalizados | ~11.600 |
| Lançamentos de auditoria | 1.400 |

---

## Roteiro de apresentação

Cada parada responde a um ponto específico do levantamento. Tempo total: 20–25 min.

### 1. Tela inicial — os quatro perfis (2 min)
Mostre os volumes reais da base e os quatro níveis de acesso.
> *"Administrador da plataforma, gestor, comprador e fornecedor. Cada um tem
> telas e permissões distintas — não é a mesma tela com botão escondido."*

Entre como **Gestor de suprimentos**.

### 2. Visão geral (2 min)
Indicadores da empresa: cotações em curso, economia apurada, ganho por
pulverização, base disponível. — *Levantamento 1.1, 1.4*

### 3. Materiais — o volume (3 min) ⭐
Esta é a parada que separa protótipo de sistema real.

- Busque **"disjuntor"**, depois **"cabo flexível"**, depois **"rolamento"**.
- Aponte o selo no canto superior direito: **tempo real da consulta em milissegundos
  sobre 100.000 registros**.
- Filtre por grupo e por curva ABC.
- Abra um material: os **cinco níveis** de classificação, os fornecedores
  homologados daquele grupo e o histórico de preços já cotados.

> *"Busca full-text indexada. Não é filtro em memória sobre uma lista pequena —
> são cem mil itens e o índice responde em milissegundos."*
> — *Levantamento 2.1, 2.2*

### 4. Fornecedores (2 min)
10.000 cadastros com homologação e **grupos de fornecimento habilitados**.
> *"É esse vínculo que decide, automaticamente, quem recebe cada cotação."*
> — *Levantamento 2.5*

Abra um fornecedor e desça até a **trilha de auditoria** — quem mudou, qual campo,
valor anterior e novo, data e IP. — *Levantamento 2.4*

### 5. Cotações e disparo programado (3 min)
Liste as cotações; mostre a coluna de retorno dos fornecedores (respondidas/convidadas).
Abra uma cotação: itens, convidados com datas de visualização e resposta, histórico
de disparos.

Vá em **Disparos programados**: janelas por dia da semana e horário, canal e prazo
de resposta, com taxa de entrega apurada. — *Levantamento 5.2*

### 6. Portal do fornecedor — ao vivo (4 min) ⭐
Na cotação aberta, clique em **Abrir** na linha de um fornecedor: você entra no
portal externo, exatamente como ele o recebe.

- Repare que o fornecedor **só vê aquela cotação** — nada da base interna,
  nada dos concorrentes, nada das outras empresas.
- **Preencha os preços e envie.** A proposta é gravada.
- Volte ao sistema interno: ela já está lá, equalizada, sem ninguém digitar nada.

> *"Aqui está o ponto que mata o processo por e-mail e planilha: a proposta entra
> estruturada. Ninguém redigita."* — *Levantamento 5.3*

### 7. Equalização automática (5 min) ⭐⭐ — o coração
Abra **Equalização** numa cotação com muitas propostas.

- **Estratégia A — menor preço global por fornecedor:** um só fornecedor, um pedido.
- **Estratégia B — menor preço por item:** o ganho adicional em reais.
- **Classificação das propostas:** mercadoria, impostos, frete, custo posto,
  condição de pagamento, prazo de entrega e **custo final comparável**.
- **Matriz de equalização:** item × fornecedor, com o menor preço destacado.
- **Memória de cálculo:** abra um item e percorra as **sete etapas**.

> *"Não é comparação de preço unitário. Entram frete, IPI e ICMS-ST, o prazo de
> entrega e o valor presente do pagamento a prazo. Duas propostas com o mesmo preço
> de tabela chegam a custos finais diferentes — e o sistema mostra por quê,
> linha a linha."* — *Levantamento 5.4, 5.5*

### 8. Integrações com ERP (2 min)
Conectores por empresa (TOTVS, SAP, Sankhya, Oracle, Senior), direção
bidirecional, fila de sincronização com duração, tentativas e mensagem de erro
do destino. — *Levantamento 3.1 a 3.3, 6.1*

### 9. Multiempresa (2 min)
Entre como **Administrador da plataforma** e troque de empresa no seletor do topo.
Em **Empresas**, mostre os oito inquilinos e o modelo de isolamento.
> *"Uma instância, oito empresas, dados isolados. O catálogo corporativo é
> compartilhado; clientes, nunca."* — *Levantamento 1.2, 7.3*

### 10. Nota de arquitetura (2 min)
A página **Arquitetura** responde, ponto a ponto, cada item do levantamento —
incluindo escala, segurança, LGPD e a preparação para IA. Deixe-a aberta para
as perguntas técnicas.

### Se perguntarem sobre celular
Abra qualquer tela no navegador do próprio telefone. A interface é responsiva e
não exige aplicativo. — *Levantamento 7.2*

---

## Como as exigências foram atendidas

| Levantamento | Onde ver |
|---|---|
| 1.2 SaaS multiempresa | seletor de empresa no topo · `/empresas` |
| 1.4 Três níveis + administrador | tela inicial · quatro perfis |
| 2.1 Volume de cadastros | `/materiais`, `/fornecedores`, `/clientes`, `/transportadoras` |
| 2.2 Cinco níveis + unidades | detalhe do material |
| 2.4 Auditoria em clientes e fornecedores | `/auditoria` · aba no detalhe do fornecedor |
| 2.5 Fornecedor por grupo de material | detalhe do fornecedor |
| 3.1–3.3 Múltiplos ERPs, mão dupla | `/integracoes` |
| 5.1 Origem das demandas | `/demandas` |
| 5.2 Disparo programado e manual | `/agendamentos` |
| 5.3 Fornecedor responde no sistema | `/portal` |
| 5.4 Todas as variáveis | equalização · memória de cálculo |
| 5.5 Menor preço global e por item | equalização · estratégias A e B |
| 6.3 Histórico de cotações | `/cotacoes` |
| 7.2 Acesso mobile | qualquer tela no celular |
| 7.3 Segurança e LGPD | `/auditoria` · `/arquitetura` |
| 4.1–4.2 IA preparada para o futuro | `/arquitetura` |

---

## Estrutura do projeto

```
Dockerfile         imagem de produção (multi-stage, saída standalone)
docker-entrypoint.sh  carrega a base na primeira subida
DEPLOY.md          passo a passo do deploy no Coolify
scripts/
  schema.sql          modelo de dados em SQLite (21 tabelas, índices, FTS5)
  schema.postgres.sql mesmo modelo em PostgreSQL (tsvector/GIN, unaccent)
  seed-postgres.mjs   aplica o schema e copia a base para o PostgreSQL
  catalogo.mjs     200 itens com medidas, unidades, faixa de preço e fabricantes
  dados.mjs        dicionários (geografia, empresas, CNPJ com dígito verificador)
  seed.mjs         carga da base demonstrativa
src/lib/
  equalizacao.ts   motor de equalização — isolado da interface e do banco
  consultas.ts     consultas compartilhadas
  sessao.ts        perfil, empresa ativa e isolamento multiempresa
src/app/
  (app)/           ambiente interno
  portal/          portal externo do fornecedor
```

O motor de equalização (`src/lib/equalizacao.ts`) não depende de banco nem de
interface: recebe itens, propostas e parâmetros, devolve o resultado apurado.
É a peça mais fácil de auditar caso o cliente queira conferir o cálculo.

### Base tecnológica

Next.js e React com renderização no servidor. SQLite com FTS5 na demonstração
local e PostgreSQL com `tsvector`/GIN em produção — as consultas das telas são
as mesmas nos dois casos.
Nenhuma dependência externa em tempo de execução — roda offline, o que evita
depender de rede na hora da apresentação.

---

## Como apresentar com honestidade

O cliente foi explícito: *"não será suficiente apresentar somente imagens, layouts,
portfólio ou protótipo"* e *"compreender qual parte foi efetivamente desenvolvida
pela empresa"*. Numa licitação, exagero descoberto custa mais caro que a proposta.

**O que se pode afirmar sem ressalva:**
- O sistema funciona de verdade: busca indexada em 100 mil registros, portal que
  grava proposta, equalização calculada a cada acesso.
- Foi integralmente desenvolvido pela empresa para esta demonstração.
- As regras de negócio saíram do levantamento do próprio cliente.

**O que precisa ser dito espontaneamente, antes de perguntarem:**
- Os dados são sintéticos, gerados por script — não são de um cliente real.
- É uma demonstração de capacidade técnica, não um sistema em produção com
  cliente pagante.

Dizer isso de saída fortalece a apresentação: mostra que a empresa distingue
o que construiu do que apenas simulou. Se o cliente pedir referências de sistemas
em produção — itens 2 e 3 do e-mail dele —, esses são pedidos separados, que
exigem clientes e equipe reais e não podem ser derivados deste projeto.
