-- =====================================================================
-- SUPRA — Plataforma de Cotacoes Corporativas (PostgreSQL)
-- Mesmo modelo relacional do ambiente local; muda apenas o dialeto:
-- identidade em vez de rowid e tsvector/GIN no lugar do FTS5.
-- Convencao: empresa_id NULL = registro do catalogo corporativo,
-- visivel por todas as empresas; empresa_id preenchido = exclusivo.
-- =====================================================================



-- Busca textual sem sensibilidade a acento: o comprador digita "flexivel" e
-- encontra "FLEXÍVEL". A extensao unaccent e STABLE, entao envolvemos numa
-- funcao IMMUTABLE (com dicionario explicito) para poder usar em coluna gerada.
create extension if not exists unaccent;

create or replace function sem_acento(texto text) returns text as
  $$ select public.unaccent('public.unaccent', texto) $$
  language sql immutable parallel safe strict;

-- ---------- Tenancy -------------------------------------------------
create table empresas (
  id            integer generated always as identity primary key,
  razao_social  text    not null,
  nome_fantasia text    not null,
  cnpj          text    not null unique,
  uf            text    not null,
  cidade        text    not null,
  segmento      text    not null,
  plano         text    not null,
  ativo         integer not null default 1,
  criado_em     text    not null
);

create table usuarios (
  id            integer generated always as identity primary key,
  empresa_id    integer references empresas(id),
  fornecedor_id integer,
  nome          text    not null,
  email         text    not null,
  cargo         text    not null,
  perfil        text    not null check (perfil in ('admin_central','gestor','comprador','fornecedor')),
  telefone      text,
  ativo         integer not null default 1,
  ultimo_acesso text
);
create index ix_usuarios_empresa on usuarios(empresa_id);
create index ix_usuarios_perfil  on usuarios(perfil);

-- ---------- Tabelas de apoio ---------------------------------------
create table unidades (
  id        integer generated always as identity primary key,
  sigla     text not null unique,
  descricao text not null,
  grandeza  text not null
);

-- Hierarquia de 5 niveis: Grupo > Subgrupo > Familia > Subfamilia > Classe
create table classificacoes (
  id      integer generated always as identity primary key,
  nivel   integer not null check (nivel between 1 and 5),
  pai_id  integer references classificacoes(id),
  codigo  text    not null,
  nome    text    not null,
  caminho text    not null
);
create index ix_class_nivel on classificacoes(nivel);
create index ix_class_pai   on classificacoes(pai_id);

-- ---------- Cadastros ----------------------------------------------
create table materiais (
  id               integer generated always as identity primary key,
  empresa_id       integer references empresas(id),
  codigo           text    not null unique,
  descricao        text    not null,
  especificacao    text,
  classificacao_id integer not null references classificacoes(id),
  unidade_id       integer not null references unidades(id),
  ncm              text,
  preco_referencia real    not null,
  curva            text    not null check (curva in ('A','B','C')),
  estoque_minimo   real,
  ativo            integer not null default 1,
  criado_em        text    not null,
  atualizado_em    text    not null
);
-- Busca textual: coluna tsvector gerada + indice GIN (equivalente ao FTS5)
alter table materiais add column busca tsvector
  generated always as (
    to_tsvector('portuguese', sem_acento(
      coalesce(codigo,'') || ' ' || coalesce(descricao,'') || ' ' || coalesce(especificacao,'')))
  ) stored;
create index ix_mat_busca on materiais using gin(busca);

create index ix_mat_class   on materiais(classificacao_id);
create index ix_mat_empresa on materiais(empresa_id);
create index ix_mat_curva   on materiais(curva);
create index ix_mat_codigo  on materiais(codigo);


create table fornecedores (
  id                integer generated always as identity primary key,
  empresa_id        integer references empresas(id),
  razao_social      text    not null,
  nome_fantasia     text    not null,
  cnpj              text    not null unique,
  email             text    not null,
  telefone          text    not null,
  contato           text    not null,
  cidade            text    not null,
  uf                text    not null,
  cond_pagamento    text    not null,
  prazo_entrega_dias integer not null,
  avaliacao         real    not null,
  homologado        integer not null default 1,
  ativo             integer not null default 1,
  criado_em         text    not null,
  atualizado_em     text    not null
);
alter table fornecedores add column busca tsvector
  generated always as (
    to_tsvector('portuguese', sem_acento(
      coalesce(razao_social,'') || ' ' || coalesce(nome_fantasia,'') || ' ' ||
      coalesce(cnpj,'') || ' ' || coalesce(cidade,'')))
  ) stored;
create index ix_forn_busca on fornecedores using gin(busca);

create index ix_forn_uf      on fornecedores(uf);
create index ix_forn_empresa on fornecedores(empresa_id);
create index ix_forn_homol   on fornecedores(homologado);


-- Grupos (nivel 1/2) que cada fornecedor esta apto a fornecer
create table fornecedor_grupos (
  fornecedor_id    integer not null references fornecedores(id),
  classificacao_id integer not null references classificacoes(id),
  primary key (fornecedor_id, classificacao_id)
);
create index ix_fg_class on fornecedor_grupos(classificacao_id);

create table clientes (
  id            integer generated always as identity primary key,
  empresa_id    integer not null references empresas(id),
  razao_social  text    not null,
  nome_fantasia text    not null,
  cnpj          text    not null unique,
  email         text    not null,
  telefone      text    not null,
  contato       text    not null,
  cidade        text    not null,
  uf            text    not null,
  segmento      text    not null,
  ativo         integer not null default 1,
  criado_em     text    not null,
  atualizado_em text    not null
);
create index ix_cli_empresa on clientes(empresa_id);

create table transportadoras (
  id            integer generated always as identity primary key,
  empresa_id    integer references empresas(id),
  razao_social  text    not null,
  nome_fantasia text    not null,
  cnpj          text    not null unique,
  email         text    not null,
  telefone      text    not null,
  cidade        text    not null,
  uf            text    not null,
  modal         text    not null,
  abrangencia   text    not null,
  prazo_medio_dias integer not null,
  ativo         integer not null default 1,
  criado_em     text    not null,
  atualizado_em text    not null
);
create index ix_transp_uf on transportadoras(uf);

-- ---------- Auditoria (LGPD / rastreabilidade) ----------------------
create table auditoria (
  id             integer generated always as identity primary key,
  empresa_id     integer references empresas(id),
  entidade       text    not null,
  entidade_id    integer not null,
  entidade_rotulo text   not null,
  campo          text    not null,
  valor_anterior text,
  valor_novo     text,
  operacao       text    not null,
  usuario_id     integer references usuarios(id),
  usuario_nome   text    not null,
  ip             text    not null,
  criado_em      text    not null
);
create index ix_aud_entidade on auditoria(entidade, entidade_id);
create index ix_aud_data     on auditoria(criado_em);
create index ix_aud_empresa  on auditoria(empresa_id);

-- ---------- Demandas de compra --------------------------------------
create table demandas (
  id           integer generated always as identity primary key,
  empresa_id   integer not null references empresas(id),
  numero       text    not null,
  origem       text    not null check (origem in ('requisicao','estoque_minimo','manual','erp')),
  solicitante  text    not null,
  centro_custo text    not null,
  status       text    not null check (status in ('aberta','em_cotacao','atendida','cancelada')),
  criado_em    text    not null
);
create index ix_dem_empresa on demandas(empresa_id);

create table demanda_itens (
  id         integer generated always as identity primary key,
  demanda_id integer not null references demandas(id),
  material_id integer not null references materiais(id),
  quantidade real   not null,
  unidade_id integer not null references unidades(id)
);
create index ix_di_demanda on demanda_itens(demanda_id);

-- ---------- Cotacoes -------------------------------------------------
create table cotacoes (
  id             integer generated always as identity primary key,
  empresa_id     integer not null references empresas(id),
  demanda_id     integer references demandas(id),
  numero         text    not null,
  titulo         text    not null,
  comprador_id   integer not null references usuarios(id),
  status         text    not null check (status in ('rascunho','programada','em_andamento','encerrada','equalizada','cancelada')),
  disparo_tipo   text    not null check (disparo_tipo in ('programado','manual')),
  canal          text    not null check (canal in ('email','portal','ambos')),
  criado_em      text    not null,
  disparado_em   text,
  encerra_em     text,
  encerrado_em   text,
  -- parametros de equalizacao vigentes na cotacao
  taxa_capital_mes real not null default 1.5,
  peso_prazo_dia   real not null default 0.0
);
create index ix_cot_empresa on cotacoes(empresa_id);
create index ix_cot_status  on cotacoes(status);

create table cotacao_itens (
  id          integer generated always as identity primary key,
  cotacao_id  integer not null references cotacoes(id),
  material_id integer not null references materiais(id),
  quantidade  real    not null,
  unidade_id  integer not null references unidades(id),
  ordem       integer not null
);
create index ix_ci_cotacao on cotacao_itens(cotacao_id);

create table cotacao_fornecedores (
  id            integer generated always as identity primary key,
  cotacao_id    integer not null references cotacoes(id),
  fornecedor_id integer not null references fornecedores(id),
  token         text    not null unique,
  status        text    not null check (status in ('convidado','visualizado','respondido','recusado','expirado')),
  convidado_em  text    not null,
  visualizado_em text,
  respondido_em text
);
create index ix_cf_cotacao on cotacao_fornecedores(cotacao_id);
create index ix_cf_forn    on cotacao_fornecedores(fornecedor_id);

create table propostas (
  id                 integer generated always as identity primary key,
  cotacao_id         integer not null references cotacoes(id),
  fornecedor_id      integer not null references fornecedores(id),
  frete_tipo         text    not null check (frete_tipo in ('CIF','FOB')),
  valor_frete        real    not null default 0,
  prazo_entrega_dias integer not null,
  cond_pagamento     text    not null,
  prazo_pagamento_dias integer not null,
  desconto_pct       real    not null default 0,
  validade_dias      integer not null,
  observacoes        text,
  enviada_em         text    not null
);
create index ix_prop_cotacao on propostas(cotacao_id);
create unique index ux_prop_forn on propostas(cotacao_id, fornecedor_id);

create table proposta_itens (
  id              integer generated always as identity primary key,
  proposta_id     integer not null references propostas(id),
  cotacao_item_id integer not null references cotacao_itens(id),
  preco_unitario  real    not null,
  ipi_pct         real    not null default 0,
  icms_st_pct     real    not null default 0,
  marca           text,
  prazo_item_dias integer,
  disponivel      integer not null default 1
);
create index ix_pi_proposta on proposta_itens(proposta_id);
create index ix_pi_item     on proposta_itens(cotacao_item_id);

-- ---------- Disparos programados -------------------------------------
create table agendamentos (
  id             integer generated always as identity primary key,
  empresa_id     integer not null references empresas(id),
  nome           text    not null,
  dias_semana    text    not null,
  horario        text    not null,
  canal          text    not null check (canal in ('email','portal','ambos')),
  janela_resposta_horas integer not null,
  ativo          integer not null default 1,
  proximo_disparo text   not null,
  criado_em      text    not null
);
create index ix_agend_empresa on agendamentos(empresa_id);

create table disparo_logs (
  id            integer generated always as identity primary key,
  empresa_id    integer not null references empresas(id),
  cotacao_id    integer references cotacoes(id),
  agendamento_id integer references agendamentos(id),
  canal         text    not null,
  destinatarios integer not null,
  entregues     integer not null,
  falhas        integer not null,
  origem        text    not null,
  criado_em     text    not null
);
create index ix_disp_empresa on disparo_logs(empresa_id);

-- ---------- Integracao ERP (bidirecional) -----------------------------
create table erp_conectores (
  id           integer generated always as identity primary key,
  empresa_id   integer not null references empresas(id),
  erp          text    not null,
  versao       text    not null,
  protocolo    text    not null,
  direcao      text    not null check (direcao in ('entrada','saida','bidirecional')),
  entidades    text    not null,
  status       text    not null check (status in ('ativo','homologacao','inativo','erro')),
  endpoint     text    not null,
  frequencia   text    not null,
  ultima_sinc  text
);
create index ix_erp_empresa on erp_conectores(empresa_id);

create table erp_eventos (
  id          integer generated always as identity primary key,
  conector_id integer not null references erp_conectores(id),
  entidade    text    not null,
  direcao     text    not null,
  referencia  text    not null,
  registros   integer not null,
  status      text    not null check (status in ('sucesso','pendente','reprocessando','erro')),
  tentativas  integer not null default 1,
  duracao_ms  integer not null,
  mensagem    text,
  criado_em   text    not null
);
create index ix_erpev_conector on erp_eventos(conector_id);
create index ix_erpev_status   on erp_eventos(status);
