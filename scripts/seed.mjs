// =====================================================================
// SUPRA — carga da base demonstrativa.
// Volumes conforme o levantamento: 100.000 materiais, 10.000 fornecedores,
// 1.000 clientes, 3.000 transportadoras, 8 empresas (multiempresa).
// Execucao: npm run seed
// =====================================================================
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  criarRng, escolher, inteiro, decimal, talvez, gerarCnpj, nomePessoa,
  CIDADES, UNIDADES, ARVORE, RADICAIS_EMPRESA, SUFIXOS_FORN, TIPOS_SOC,
  SUFIXOS_TRANSP, SEGMENTOS_CLIENTE, COND_PAGAMENTO, CENTROS_CUSTO, MODAIS,
  ABRANGENCIAS, ERPS,
} from './dados.mjs'
import { CATALOGO } from './catalogo.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(__dirname, '..')
const DB_PATH = join(RAIZ, 'data', 'supra.db')

const QTD_MATERIAIS = Number(process.env.QTD_MATERIAIS ?? 100000)
const QTD_FORNECEDORES = Number(process.env.QTD_FORNECEDORES ?? 10000)
const QTD_CLIENTES = Number(process.env.QTD_CLIENTES ?? 1000)
const QTD_TRANSPORTADORAS = Number(process.env.QTD_TRANSPORTADORAS ?? 3000)
const QTD_COTACOES = Number(process.env.QTD_COTACOES ?? 220)

const rng = criarRng(20260818)
const AGORA = new Date('2026-08-18T12:00:00Z')
const iso = (d) => d.toISOString()
const atras = (min, max) => new Date(AGORA.getTime() - (inteiro(rng, min, max) * 86400000) - inteiro(rng, 0, 86399) * 1000)
const frente = (min, max) => new Date(AGORA.getTime() + (inteiro(rng, min, max) * 86400000) + inteiro(rng, 0, 86399) * 1000)
const pad = (n, l = 6) => String(n).padStart(l, '0')

const t0 = Date.now()
const passo = (msg) => console.log(`  ${String((Date.now() - t0) / 1000).padStart(6)}s  ${msg}`)

// ---------------------------------------------------------------- setup
mkdirSync(join(RAIZ, 'data'), { recursive: true })
for (const f of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`, `${DB_PATH}-journal`]) {
  if (existsSync(f)) rmSync(f)
}
const db = new DatabaseSync(DB_PATH)
db.exec(readFileSync(join(__dirname, 'schema.sql'), 'utf8'))
passo('schema aplicado')

const cnpjsUsados = new Set()
function cnpjUnico() {
  for (;;) {
    const c = gerarCnpj(rng)
    if (!cnpjsUsados.has(c)) { cnpjsUsados.add(c); return c }
  }
}
const emailDe = (nome) => nome.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 28)
const telefone = () => `(${inteiro(rng, 11, 99)}) ${inteiro(rng, 3, 9)}${inteiro(rng, 1000, 9999)}-${inteiro(rng, 1000, 9999)}`

db.exec('begin')

// ---------------------------------------------------------------- empresas
const EMPRESAS = [
  ['Cooperativa Agroindustrial Vale Verde', 'COOPERVALE', 'Agronegócio', 'Corporativo'],
  ['Metalúrgica Bandeirante S.A.', 'Bandeirante Metais', 'Indústria Metalúrgica', 'Corporativo'],
  ['Construtora Horizonte Ltda', 'Horizonte Engenharia', 'Construção Civil', 'Profissional'],
  ['Rede Nordeste de Supermercados S.A.', 'Rede Nordeste', 'Varejo', 'Corporativo'],
  ['Ipiranga Logística e Transportes Ltda', 'Ipiranga Log', 'Transporte e Logística', 'Profissional'],
  ['Associação Hospitalar Santa Rita', 'Santa Rita Saúde', 'Saúde', 'Corporativo'],
  ['Usina Triângulo Energia S.A.', 'Triângulo Energia', 'Energia', 'Corporativo'],
  ['Cooperativa de Saneamento Planalto', 'SanePlan', 'Saneamento', 'Profissional'],
]
const stEmpresa = db.prepare(`insert into empresas (id,razao_social,nome_fantasia,cnpj,uf,cidade,segmento,plano,ativo,criado_em) values (?,?,?,?,?,?,?,?,1,?)`)
EMPRESAS.forEach((e, i) => {
  const [cid, uf] = escolher(rng, CIDADES)
  stEmpresa.run(i + 1, e[0], e[1], cnpjUnico(), uf, cid, e[2], e[3], iso(atras(400, 1200)))
})
const idsEmpresa = EMPRESAS.map((_, i) => i + 1)
passo(`${EMPRESAS.length} empresas`)

// ---------------------------------------------------------------- unidades
const stUnid = db.prepare('insert into unidades (id,sigla,descricao,grandeza) values (?,?,?,?)')
UNIDADES.forEach((u, i) => stUnid.run(i + 1, u[0], u[1], u[2]))
const idsUnidade = UNIDADES.map((_, i) => i + 1)
passo(`${UNIDADES.length} unidades de medida`)

// ---------------------------------------------------------------- classificacoes (5 niveis)
const stClass = db.prepare('insert into classificacoes (id,nivel,pai_id,codigo,nome,caminho) values (?,?,?,?,?,?)')
let classId = 0
const folhas = []          // {id, grupo, grupoId}
const gruposN1 = []        // {id, nome}
const gruposN2 = []        // {id, nome, grupoNome}

for (let gi = 0; gi < ARVORE.length; gi++) {
  const no = ARVORE[gi]
  const idG = ++classId
  const codG = pad(gi + 1, 2)
  stClass.run(idG, 1, null, codG, no.g, no.g)
  gruposN1.push({ id: idG, nome: no.g })

  no.sub.forEach((s, si) => {
    const idS = ++classId
    const codS = `${codG}.${pad(si + 1, 2)}`
    stClass.run(idS, 2, idG, codS, s, `${no.g} › ${s}`)
    gruposN2.push({ id: idS, nome: s, grupoNome: no.g })

    no.fam.forEach((f, fi) => {
      const idF = ++classId
      const codF = `${codS}.${pad(fi + 1, 2)}`
      stClass.run(idF, 3, idS, codF, f, `${no.g} › ${s} › ${f}`)

      no.subfam.forEach((sf, sfi) => {
        const idSF = ++classId
        const codSF = `${codF}.${pad(sfi + 1, 2)}`
        stClass.run(idSF, 4, idF, codSF, sf, `${no.g} › ${s} › ${f} › ${sf}`)

        no.cls.forEach((c, ci) => {
          const idC = ++classId
          const codC = `${codSF}.${pad(ci + 1, 2)}`
          stClass.run(idC, 5, idSF, codC, c, `${no.g} › ${s} › ${f} › ${sf} › ${c}`)
          folhas.push({ id: idC, grupo: no.g, grupoId: idG })
        })
      })
    })
  })
}
passo(`${classId} nós de classificação (5 níveis, ${folhas.length} classes folha)`)

// ---------------------------------------------------------------- materiais
const stMat = db.prepare(`insert into materiais
  (id,empresa_id,codigo,descricao,especificacao,classificacao_id,unidade_id,ncm,preco_referencia,curva,estoque_minimo,ativo,criado_em,atualizado_em)
  values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)

// indice de unidades por sigla, para amarrar a unidade ao item
const idUnidadePorSigla = new Map(UNIDADES.map((u, i) => [u[0], i + 1]))

for (let i = 1; i <= QTD_MATERIAIS; i++) {
  const folha = folhas[Math.floor(rng() * folhas.length)]
  const [nome, medidas, atributos, unidades, cores, faixa, marcas] =
    escolher(rng, CATALOGO[folha.grupo])

  // A medida define a posicao dentro da faixa de preco do item: as listas de
  // medidas estao em ordem crescente, entao o 12" custa mais que o 4.1/2".
  const iMedida = Math.floor(rng() * medidas.length)
  const medida = medidas[iMedida]
  const posMedida = medidas.length > 1 ? iMedida / (medidas.length - 1) : 0.5

  // Marcas estao listadas da premium para a de entrada — leve premio de marca.
  const iMarca = Math.floor(rng() * marcas.length)
  const marca = marcas[iMarca]
  const fatorMarca = marcas.length > 1 ? 1.14 - (iMarca / (marcas.length - 1)) * 0.26 : 1
  const cor = cores.length && talvez(rng, 0.6) ? ` ${escolher(rng, cores)}` : ''

  // Um unico atributo por descricao: atributos do mesmo item sao alternativas
  // excludentes entre si (RIGIDO vs FLEXIVEL, PARA INOX vs PARA FERRO), e
  // combina-los produziria descricao contraditoria.
  const atributo = escolher(rng, atributos)

  const descricao = `${nome} ${medida} ${atributo}${cor} - ${marca}`
  const sigla = escolher(rng, unidades)
  const unidadeId = idUnidadePorSigla.get(sigla) ?? 1
  const unidadeDesc = UNIDADES.find((u) => u[0] === sigla)?.[1] ?? sigla

  const especificacao =
    `Fabricante ${marca}, referência ${marca.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}-${pad(inteiro(rng, 1, 99999), 5)}. ` +
    `Fornecimento em ${unidadeDesc.toLowerCase()}. Conforme norma técnica aplicável e embalagem padrão do fabricante.`

  const [pmin, pmax] = faixa
  const bruto = pmin * Math.pow(pmax / pmin, posMedida) * fatorMarca * decimal(rng, 0.9, 1.12, 4)
  const preco = Number(Math.min(pmax * 1.15, Math.max(pmin * 0.88, bruto)).toFixed(2))
  // Curva ABC pelo valor absoluto do item no catalogo
  const curva = preco >= 500 ? 'A' : preco >= 50 ? 'B' : 'C'

  // 68% catalogo corporativo, 32% exclusivo de uma empresa
  const empresaId = talvez(rng, 0.68) ? null : escolher(rng, idsEmpresa)
  const criado = atras(30, 1100)
  stMat.run(
    i, empresaId, `MAT-${pad(i)}`, descricao, especificacao, folha.id, unidadeId,
    `${inteiro(rng, 1000, 9999)}.${inteiro(rng, 10, 99)}.${inteiro(rng, 10, 99)}`,
    preco, curva, talvez(rng, 0.4) ? inteiro(rng, 1, 500) : null,
    talvez(rng, 0.965) ? 1 : 0, iso(criado),
    iso(new Date(criado.getTime() + inteiro(rng, 0, 25) * 86400000)),
  )
  if (i % 25000 === 0) passo(`  ...${i} materiais`)
}
passo(`${QTD_MATERIAIS} materiais`)

db.exec(`insert into materiais_fts(materiais_fts) values('rebuild')`)
passo('índice full-text (FTS5) de materiais reconstruído')

// ---------------------------------------------------------------- fornecedores
const stForn = db.prepare(`insert into fornecedores
  (id,empresa_id,razao_social,nome_fantasia,cnpj,email,telefone,contato,cidade,uf,cond_pagamento,prazo_entrega_dias,avaliacao,homologado,ativo,criado_em,atualizado_em)
  values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
const stFornGrupo = db.prepare('insert or ignore into fornecedor_grupos (fornecedor_id,classificacao_id) values (?,?)')

for (let i = 1; i <= QTD_FORNECEDORES; i++) {
  const radical = escolher(rng, RADICAIS_EMPRESA)
  const suf = escolher(rng, SUFIXOS_FORN)
  const fantasia = `${radical} ${suf.split(' ')[0]}`
  const razao = `${radical} ${suf} ${escolher(rng, TIPOS_SOC)}`
  const [cid, uf] = escolher(rng, CIDADES)
  const contato = nomePessoa(rng)
  const criado = atras(60, 1400)
  stForn.run(
    i, talvez(rng, 0.88) ? null : escolher(rng, idsEmpresa),
    razao, fantasia, cnpjUnico(),
    `${emailDe(contato.split(' ')[0])}@${emailDe(radical)}.com.br`,
    telefone(), contato, cid, uf,
    escolher(rng, COND_PAGAMENTO)[0], inteiro(rng, 3, 45),
    decimal(rng, 2.6, 5.0, 1), talvez(rng, 0.82) ? 1 : 0,
    talvez(rng, 0.95) ? 1 : 0, iso(criado),
    iso(new Date(criado.getTime() + inteiro(rng, 0, 40) * 86400000)),
  )
  // cada fornecedor atende de 1 a 4 grupos (nivel 1) e alguns subgrupos
  const nGrupos = inteiro(rng, 1, 3)
  for (let k = 0; k < nGrupos; k++) stFornGrupo.run(i, escolher(rng, gruposN1).id)
  for (let k = 0; k < inteiro(rng, 1, 4); k++) stFornGrupo.run(i, escolher(rng, gruposN2).id)
  if (i % 5000 === 0) passo(`  ...${i} fornecedores`)
}
db.exec(`insert into fornecedores_fts(fornecedores_fts) values('rebuild')`)
passo(`${QTD_FORNECEDORES} fornecedores + vínculos de grupo + FTS`)

// ---------------------------------------------------------------- clientes
const stCli = db.prepare(`insert into clientes
  (id,empresa_id,razao_social,nome_fantasia,cnpj,email,telefone,contato,cidade,uf,segmento,ativo,criado_em,atualizado_em)
  values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
for (let i = 1; i <= QTD_CLIENTES; i++) {
  const radical = escolher(rng, RADICAIS_EMPRESA)
  const [cid, uf] = escolher(rng, CIDADES)
  const contato = nomePessoa(rng)
  const criado = atras(45, 1300)
  stCli.run(i, escolher(rng, idsEmpresa),
    `${radical} ${escolher(rng, ['Indústria', 'Comércio', 'Serviços', 'Participações'])} ${escolher(rng, TIPOS_SOC)}`,
    radical, cnpjUnico(),
    `contato@${emailDe(radical)}.com.br`, telefone(), contato, cid, uf,
    escolher(rng, SEGMENTOS_CLIENTE), talvez(rng, 0.94) ? 1 : 0,
    iso(criado), iso(new Date(criado.getTime() + inteiro(rng, 0, 30) * 86400000)))
}
passo(`${QTD_CLIENTES} clientes`)

// ---------------------------------------------------------------- transportadoras
const stTr = db.prepare(`insert into transportadoras
  (id,empresa_id,razao_social,nome_fantasia,cnpj,email,telefone,cidade,uf,modal,abrangencia,prazo_medio_dias,ativo,criado_em,atualizado_em)
  values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
for (let i = 1; i <= QTD_TRANSPORTADORAS; i++) {
  const radical = escolher(rng, RADICAIS_EMPRESA)
  const suf = escolher(rng, SUFIXOS_TRANSP)
  const [cid, uf] = escolher(rng, CIDADES)
  const criado = atras(45, 1300)
  stTr.run(i, talvez(rng, 0.9) ? null : escolher(rng, idsEmpresa),
    `${radical} ${suf} ${escolher(rng, TIPOS_SOC)}`, `${radical} ${suf.split(' ')[0]}`,
    cnpjUnico(), `operacional@${emailDe(radical)}log.com.br`, telefone(), cid, uf,
    escolher(rng, MODAIS), escolher(rng, ABRANGENCIAS), inteiro(rng, 1, 21),
    talvez(rng, 0.95) ? 1 : 0, iso(criado),
    iso(new Date(criado.getTime() + inteiro(rng, 0, 30) * 86400000)))
}
passo(`${QTD_TRANSPORTADORAS} transportadoras`)

// ---------------------------------------------------------------- usuarios
const CARGOS_GESTOR = ['Gerente de Suprimentos', 'Coordenador de Compras', 'Gestor de Contratos', 'Supervisor de Suprimentos']
const CARGOS_COMPRADOR = ['Comprador Pleno', 'Comprador Sênior', 'Comprador Júnior', 'Analista de Compras', 'Assistente de Compras']
const stUser = db.prepare(`insert into usuarios (id,empresa_id,fornecedor_id,nome,email,cargo,perfil,telefone,ativo,ultimo_acesso) values (?,?,?,?,?,?,?,?,?,?)`)

let userId = 0
const compradoresPorEmpresa = {}
const gestoresPorEmpresa = {}

// administradores centrais (operam a plataforma, sem vinculo a uma empresa)
for (const nome of ['Marcos Aurélio Tavares', 'Renata Coelho Braga', 'Paulo Cesar Menezes']) {
  stUser.run(++userId, null, null, nome, `${emailDe(nome)}@supra.com.br`,
    'Administrador da Plataforma', 'admin_central', telefone(), 1, iso(atras(0, 3)))
}

for (const eid of idsEmpresa) {
  gestoresPorEmpresa[eid] = []
  compradoresPorEmpresa[eid] = []
  const dominio = emailDe(EMPRESAS[eid - 1][1])
  for (let k = 0; k < inteiro(rng, 2, 4); k++) {
    const nome = nomePessoa(rng)
    stUser.run(++userId, eid, null, nome, `${emailDe(nome)}@${dominio}.com.br`,
      escolher(rng, CARGOS_GESTOR), 'gestor', telefone(), 1, iso(atras(0, 12)))
    gestoresPorEmpresa[eid].push(userId)
  }
  for (let k = 0; k < inteiro(rng, 25, 45); k++) {
    const nome = nomePessoa(rng)
    stUser.run(++userId, eid, null, nome, `${emailDe(nome)}@${dominio}.com.br`,
      escolher(rng, CARGOS_COMPRADOR), 'comprador', telefone(), talvez(rng, 0.96) ? 1 : 0, iso(atras(0, 25)))
    compradoresPorEmpresa[eid].push(userId)
  }
}
const totalCompradores = Object.values(compradoresPorEmpresa).reduce((s, a) => s + a.length, 0)

// usuarios do portal do fornecedor
for (let i = 1; i <= 600; i++) {
  const fid = inteiro(rng, 1, QTD_FORNECEDORES)
  const f = db.prepare('select razao_social,contato,email from fornecedores where id=?').get(fid)
  stUser.run(++userId, null, fid, f.contato, f.email, 'Representante Comercial', 'fornecedor', telefone(), 1, iso(atras(0, 40)))
}
passo(`${userId} usuários (${totalCompradores} compradores, 600 acessos de fornecedor)`)

// ---------------------------------------------------------------- pools em memoria
const todosMateriais = db.prepare('select id, empresa_id, unidade_id, preco_referencia, classificacao_id, descricao from materiais where ativo=1').all()
const matCorporativos = todosMateriais.filter((m) => m.empresa_id === null)
const matPorEmpresa = {}
for (const eid of idsEmpresa) matPorEmpresa[eid] = todosMateriais.filter((m) => m.empresa_id === eid)

// classificacao folha -> grupo N1 (para escolher fornecedores aptos)
const grupoDaFolha = new Map(folhas.map((f) => [f.id, f.grupoId]))

// grupo N1 -> fornecedores homologados
const fornPorGrupo = {}
for (const g of gruposN1) {
  fornPorGrupo[g.id] = db.prepare(
    `select fg.fornecedor_id id from fornecedor_grupos fg
      join fornecedores f on f.id = fg.fornecedor_id
     where fg.classificacao_id = ? and f.homologado = 1 and f.ativo = 1`
  ).all(g.id).map((r) => r.id)
}
const dadosForn = new Map(
  db.prepare('select id, cond_pagamento, prazo_entrega_dias, avaliacao from fornecedores').all().map((f) => [f.id, f])
)
passo('pools de seleção carregados')

// ---------------------------------------------------------------- demandas
const stDem = db.prepare('insert into demandas (id,empresa_id,numero,origem,solicitante,centro_custo,status,criado_em) values (?,?,?,?,?,?,?,?)')
const stDemItem = db.prepare('insert into demanda_itens (demanda_id,material_id,quantidade,unidade_id) values (?,?,?,?)')
const ORIGENS = ['requisicao', 'requisicao', 'estoque_minimo', 'estoque_minimo', 'manual', 'erp']
let demandaId = 0
const demandasPorEmpresa = {}
for (const eid of idsEmpresa) demandasPorEmpresa[eid] = []

for (let i = 0; i < 520; i++) {
  const eid = escolher(rng, idsEmpresa)
  const pool = talvez(rng, 0.8) ? matCorporativos : (matPorEmpresa[eid].length ? matPorEmpresa[eid] : matCorporativos)
  const criado = atras(1, 240)
  stDem.run(++demandaId, eid, `REQ-2026-${pad(demandaId, 5)}`, escolher(rng, ORIGENS),
    nomePessoa(rng), escolher(rng, CENTROS_CUSTO),
    escolher(rng, ['aberta', 'em_cotacao', 'em_cotacao', 'atendida', 'atendida', 'cancelada']), iso(criado))
  for (let k = 0; k < inteiro(rng, 2, 14); k++) {
    const m = escolher(rng, pool)
    stDemItem.run(demandaId, m.id, inteiro(rng, 1, 400), m.unidade_id)
  }
  demandasPorEmpresa[eid].push(demandaId)
}
passo(`${demandaId} demandas de compra`)

// ---------------------------------------------------------------- cotacoes + propostas
const stCot = db.prepare(`insert into cotacoes
  (id,empresa_id,demanda_id,numero,titulo,comprador_id,status,disparo_tipo,canal,criado_em,disparado_em,encerra_em,encerrado_em,taxa_capital_mes,peso_prazo_dia)
  values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
const stCotItem = db.prepare('insert into cotacao_itens (id,cotacao_id,material_id,quantidade,unidade_id,ordem) values (?,?,?,?,?,?)')
const stCotForn = db.prepare(`insert into cotacao_fornecedores (id,cotacao_id,fornecedor_id,token,status,convidado_em,visualizado_em,respondido_em) values (?,?,?,?,?,?,?,?)`)
const stProp = db.prepare(`insert into propostas
  (id,cotacao_id,fornecedor_id,frete_tipo,valor_frete,prazo_entrega_dias,cond_pagamento,prazo_pagamento_dias,desconto_pct,validade_dias,observacoes,enviada_em)
  values (?,?,?,?,?,?,?,?,?,?,?,?)`)
const stPropItem = db.prepare(`insert into proposta_itens
  (proposta_id,cotacao_item_id,preco_unitario,ipi_pct,icms_st_pct,marca,prazo_item_dias,disponivel) values (?,?,?,?,?,?,?,?)`)

const STATUS_COT = [
  ...Array(8).fill('rascunho'), ...Array(11).fill('programada'), ...Array(24).fill('em_andamento'),
  ...Array(15).fill('encerrada'), ...Array(39).fill('equalizada'), ...Array(3).fill('cancelada'),
]
const TITULOS = ['Reposição de almoxarifado', 'Manutenção preventiva anual', 'Ampliação da linha de produção',
  'Reforma administrativa', 'Renovação de EPIs', 'Obra civil - galpão', 'Frota - revisão programada',
  'Modernização de TI', 'Insumos de operação', 'Suprimentos trimestrais', 'Parada de manutenção',
  'Projeto de automação', 'Rede elétrica - adequação NR-10', 'Expansão do centro de distribuição']

let cotId = 0, cotItemId = 0, cotFornId = 0, propId = 0, totalPropostas = 0, totalPropItens = 0
const tokenDe = (n) => `PT${pad(n, 5)}${Math.floor(rng() * 1e8).toString(36).toUpperCase().padStart(6, 'X')}`

for (let c = 0; c < QTD_COTACOES; c++) {
  const eid = escolher(rng, idsEmpresa)
  const status = escolher(rng, STATUS_COT)
  const comprador = escolher(rng, compradoresPorEmpresa[eid])
  const pool = talvez(rng, 0.82) ? matCorporativos : (matPorEmpresa[eid].length ? matPorEmpresa[eid] : matCorporativos)
  const disparoTipo = talvez(rng, 0.72) ? 'programado' : 'manual'
  const canal = escolher(rng, ['ambos', 'ambos', 'email', 'portal'])
  const taxaCapital = decimal(rng, 0.9, 2.2, 2)
  const pesoPrazo = talvez(rng, 0.5) ? decimal(rng, 0.02, 0.18, 3) : 0

  let criado, disparado = null, encerra = null, encerrado = null
  if (status === 'rascunho') { criado = atras(0, 12) }
  else if (status === 'programada') { criado = atras(1, 20); encerra = frente(2, 12) }
  else if (status === 'em_andamento') { criado = atras(3, 25); disparado = atras(1, 8); encerra = frente(1, 9) }
  else { criado = atras(30, 210); disparado = new Date(criado.getTime() + 86400000); encerra = new Date(disparado.getTime() + inteiro(rng, 3, 12) * 86400000); encerrado = encerra }

  const cid = ++cotId
  stCot.run(cid, eid, talvez(rng, 0.65) && demandasPorEmpresa[eid].length ? escolher(rng, demandasPorEmpresa[eid]) : null,
    `COT-2026-${pad(cid, 5)}`, escolher(rng, TITULOS), comprador, status, disparoTipo, canal,
    iso(criado), disparado ? iso(disparado) : null, encerra ? iso(encerra) : null, encerrado ? iso(encerrado) : null,
    taxaCapital, pesoPrazo)

  // itens
  const nItens = inteiro(rng, 4, 22)
  const itens = []
  const usados = new Set()
  for (let k = 0; k < nItens; k++) {
    const m = escolher(rng, pool)
    if (usados.has(m.id)) continue
    usados.add(m.id)
    const qtd = inteiro(rng, 1, 350)
    const iid = ++cotItemId
    stCotItem.run(iid, cid, m.id, qtd, m.unidade_id, itens.length + 1)
    // a marca especificada no material e a referencia que o fornecedor cota
    const marcaEspecificada = (m.descricao.split(' - ').pop() || '').trim()
    itens.push({ id: iid, materialId: m.id, qtd, preco: m.preco_referencia,
                 classId: m.classificacao_id, marca: marcaEspecificada })
  }
  if (!itens.length) continue

  // fornecedores aptos aos grupos dos itens
  const gruposCot = new Set(itens.map((i) => grupoDaFolha.get(i.classId)).filter(Boolean))
  const candidatos = new Set()
  for (const g of gruposCot) for (const f of (fornPorGrupo[g] || [])) candidatos.add(f)
  const listaCand = [...candidatos]
  if (!listaCand.length) continue

  const nConvites = Math.min(listaCand.length, inteiro(rng, 4, 12))
  const convidados = []
  const escolhidos = new Set()
  while (convidados.length < nConvites) {
    const f = escolher(rng, listaCand)
    if (escolhidos.has(f)) continue
    escolhidos.add(f); convidados.push(f)
  }

  const respondeEsperado = status === 'rascunho' || status === 'programada' ? 0
    : status === 'em_andamento' ? 0.55 : 0.78

  for (const fid of convidados) {
    const cfId = ++cotFornId
    const convidadoEm = disparado || criado
    let stCf = 'convidado', visto = null, respondido = null

    if (status !== 'rascunho' && status !== 'programada') {
      if (talvez(rng, 0.88)) { visto = new Date(convidadoEm.getTime() + inteiro(rng, 1, 40) * 3600000); stCf = 'visualizado' }
      if (visto && talvez(rng, respondeEsperado)) {
        respondido = new Date(visto.getTime() + inteiro(rng, 1, 72) * 3600000)
        stCf = 'respondido'
      } else if (visto && talvez(rng, 0.12)) stCf = 'recusado'
      else if (!visto && status !== 'em_andamento') stCf = 'expirado'
    }
    stCotForn.run(cfId, cid, fid, tokenDe(cfId), stCf, iso(convidadoEm),
      visto ? iso(visto) : null, respondido ? iso(respondido) : null)

    if (stCf !== 'respondido') continue

    // ---- proposta ----
    const f = dadosForn.get(fid)
    const fatorFornecedor = decimal(rng, 0.76, 1.12, 4)   // competitividade estrutural
    const freteTipo = talvez(rng, 0.6) ? 'CIF' : 'FOB'
    const condPg = escolher(rng, COND_PAGAMENTO)
    const pid = ++propId
    const baseTotal = itens.reduce((s, i) => s + i.preco * i.qtd, 0)

    stProp.run(pid, cid, fid, freteTipo,
      freteTipo === 'FOB' ? Number((baseTotal * decimal(rng, 0.008, 0.045, 4)).toFixed(2)) : 0,
      Math.max(1, f.prazo_entrega_dias + inteiro(rng, -4, 10)),
      condPg[0], condPg[1], talvez(rng, 0.35) ? decimal(rng, 0.5, 6, 2) : 0,
      inteiro(rng, 10, 60),
      talvez(rng, 0.3) ? escolher(rng, ['Preço válido para o lote completo.', 'Entrega parcelada mediante programação.', 'Produto sujeito a disponibilidade de estoque.', 'Frete incluso para capitais.']) : null,
      iso(respondido))
    totalPropostas++

    for (const it of itens) {
      const disponivel = talvez(rng, 0.94) ? 1 : 0
      const precoUnit = Number((it.preco * fatorFornecedor * decimal(rng, 0.93, 1.07, 4)).toFixed(2))
      const marcaOfertada = talvez(rng, 0.72)
        ? it.marca                                   // atende a marca especificada
        : escolher(rng, ['Similar homologado', 'Equivalente técnico', 'Marca própria'])
      stPropItem.run(pid, it.id, disponivel ? precoUnit : 0,
        escolher(rng, [0, 0, 0, 5, 5, 10, 15]), talvez(rng, 0.18) ? decimal(rng, 2, 18, 2) : 0,
        marcaOfertada || null, talvez(rng, 0.25) ? inteiro(rng, 2, 40) : null, disponivel)
      totalPropItens++
    }
  }
  if ((c + 1) % 80 === 0) passo(`  ...${c + 1} cotações`)
}
passo(`${cotId} cotações · ${cotItemId} itens · ${cotFornId} convites · ${totalPropostas} propostas · ${totalPropItens} itens propostos`)

// ---------------------------------------------------------------- agendamentos de disparo
const stAgend = db.prepare(`insert into agendamentos (id,empresa_id,nome,dias_semana,horario,canal,janela_resposta_horas,ativo,proximo_disparo,criado_em) values (?,?,?,?,?,?,?,?,?,?)`)
const JANELAS = [
  ['Rodada diária de reposição', 'Seg,Ter,Qua,Qui,Sex', '08:00'],
  ['Cotação semanal de almoxarifado', 'Seg', '07:30'],
  ['Rodada de EPIs', 'Qua', '09:00'],
  ['Manutenção — bissemanal', 'Ter,Qui', '14:00'],
  ['Fechamento quinzenal de frota', 'Sex', '16:00'],
  ['Rodada de insumos críticos', 'Seg,Qua,Sex', '06:45'],
]
let agendId = 0
const agendPorEmpresa = {}
for (const eid of idsEmpresa) {
  agendPorEmpresa[eid] = []
  const quantas = inteiro(rng, 2, 3)
  for (let k = 0; k < quantas; k++) {
    const j = escolher(rng, JANELAS)
    // a primeira janela de cada empresa e sempre ativa: nenhuma empresa fica
    // sem disparo programado na demonstracao
    const ativo = k === 0 ? 1 : (talvez(rng, 0.75) ? 1 : 0)
    stAgend.run(++agendId, eid, j[0], j[1], j[2], escolher(rng, ['ambos', 'ambos', 'email', 'portal']),
      escolher(rng, [24, 48, 48, 72, 96]), ativo, iso(frente(0, 6)), iso(atras(60, 500)))
    agendPorEmpresa[eid].push(agendId)
  }
}

const stDisp = db.prepare(`insert into disparo_logs (empresa_id,cotacao_id,agendamento_id,canal,destinatarios,entregues,falhas,origem,criado_em) values (?,?,?,?,?,?,?,?,?)`)
const cotacoesDisparadas = db.prepare(`select id, empresa_id, canal from cotacoes where disparado_em is not null`).all()
let totalDisparos = 0
for (const c of cotacoesDisparadas) {
  const dest = inteiro(rng, 4, 12)
  const falhas = talvez(rng, 0.22) ? inteiro(rng, 1, 2) : 0
  const ag = agendPorEmpresa[c.empresa_id]
  stDisp.run(c.empresa_id, c.id, ag.length && talvez(rng, 0.7) ? escolher(rng, ag) : null,
    c.canal, dest, dest - falhas, falhas,
    talvez(rng, 0.72) ? 'agendamento' : 'manual', iso(atras(1, 200)))
  totalDisparos++
}
passo(`${agendId} agendamentos de disparo · ${totalDisparos} registros de envio`)

// ---------------------------------------------------------------- integracao ERP
const stConector = db.prepare(`insert into erp_conectores (id,empresa_id,erp,versao,protocolo,direcao,entidades,status,endpoint,frequencia,ultima_sinc) values (?,?,?,?,?,?,?,?,?,?,?)`)
const stEvento = db.prepare(`insert into erp_eventos (conector_id,entidade,direcao,referencia,registros,status,tentativas,duracao_ms,mensagem,criado_em) values (?,?,?,?,?,?,?,?,?,?)`)
const ENTIDADES_ERP = ['Materiais', 'Fornecedores', 'Centros de Custo', 'Requisições', 'Pedidos de Compra', 'Unidades de Medida', 'Condições de Pagamento']
let conectorId = 0
const conectores = []
for (const eid of idsEmpresa) {
  const usados = new Set()
  for (let k = 0; k < inteiro(rng, 1, 3); k++) {
    const erp = escolher(rng, ERPS)
    if (usados.has(erp[0])) continue
    usados.add(erp[0])
    const ents = [...new Set(Array.from({ length: inteiro(rng, 3, 6) }, () => escolher(rng, ENTIDADES_ERP)))]
    const st = escolher(rng, ['ativo', 'ativo', 'ativo', 'homologacao', 'erro', 'inativo'])
    stConector.run(++conectorId, eid, erp[0], erp[1], erp[2],
      escolher(rng, ['bidirecional', 'bidirecional', 'entrada', 'saida']), ents.join(', '), st,
      `https://erp.${emailDe(EMPRESAS[eid - 1][1])}.com.br/api/v1/integracao`,
      escolher(rng, ['A cada 15 min', 'A cada 1 hora', 'A cada 4 horas', 'Diária 03:00', 'Tempo real (webhook)']),
      st === 'inativo' ? null : iso(atras(0, 3)))
    conectores.push(conectorId)
  }
}
let totalEventos = 0
for (const cid of conectores) {
  for (let k = 0; k < inteiro(rng, 15, 45); k++) {
    const st = escolher(rng, ['sucesso', 'sucesso', 'sucesso', 'sucesso', 'sucesso', 'sucesso', 'pendente', 'reprocessando', 'erro'])
    const ent = escolher(rng, ENTIDADES_ERP)
    stEvento.run(cid, ent, escolher(rng, ['entrada', 'saida']),
      `SYNC-${pad(inteiro(rng, 1, 999999), 6)}`, inteiro(rng, 1, 4800), st,
      st === 'erro' || st === 'reprocessando' ? inteiro(rng, 2, 5) : 1,
      inteiro(rng, 45, 9800),
      st === 'erro' ? escolher(rng, ['Timeout ao consultar endpoint do ERP (30s).', 'Registro rejeitado: centro de custo inexistente no destino.', 'Falha de autenticação: token expirado.', 'Payload inválido: campo obrigatório ausente (unidade de medida).'])
        : st === 'reprocessando' ? 'Reenfileirado automaticamente pela política de retry.' : null,
      iso(atras(0, 45)))
    totalEventos++
  }
}
passo(`${conectorId} conectores ERP · ${totalEventos} eventos na fila de sincronização`)

// ---------------------------------------------------------------- auditoria
const stAud = db.prepare(`insert into auditoria (empresa_id,entidade,entidade_id,entidade_rotulo,campo,valor_anterior,valor_novo,operacao,usuario_id,usuario_nome,ip,criado_em) values (?,?,?,?,?,?,?,?,?,?,?,?)`)
const usuariosInternos = db.prepare(`select id, nome, empresa_id from usuarios where perfil in ('gestor','comprador','admin_central')`).all()
const CAMPOS_FORN = [
  ['cond_pagamento', () => escolher(rng, COND_PAGAMENTO)[0]],
  ['prazo_entrega_dias', () => String(inteiro(rng, 3, 45))],
  ['email', () => `contato${inteiro(rng, 1, 99)}@fornecedor.com.br`],
  ['telefone', () => telefone()],
  ['homologado', () => escolher(rng, ['0', '1'])],
  ['avaliacao', () => String(decimal(rng, 2.6, 5, 1))],
]
const CAMPOS_CLI = [
  ['email', () => `financeiro${inteiro(rng, 1, 99)}@cliente.com.br`],
  ['telefone', () => telefone()],
  ['contato', () => nomePessoa(rng)],
  ['segmento', () => escolher(rng, SEGMENTOS_CLIENTE)],
  ['ativo', () => escolher(rng, ['0', '1'])],
]
const ip = () => `${inteiro(rng, 10, 200)}.${inteiro(rng, 0, 255)}.${inteiro(rng, 0, 255)}.${inteiro(rng, 1, 254)}`
let totalAud = 0
for (let k = 0; k < 1400; k++) {
  const ehForn = talvez(rng, 0.62)
  const u = escolher(rng, usuariosInternos)
  const op = talvez(rng, 0.82) ? 'alteracao' : (talvez(rng, 0.6) ? 'inclusao' : 'inativacao')
  if (ehForn) {
    const fid = inteiro(rng, 1, QTD_FORNECEDORES)
    const f = db.prepare('select razao_social from fornecedores where id=?').get(fid)
    const [campo, gerar] = escolher(rng, CAMPOS_FORN)
    stAud.run(u.empresa_id, 'fornecedores', fid, f.razao_social, op === 'inclusao' ? '—' : campo,
      op === 'inclusao' ? null : gerar(), op === 'inativacao' ? 'inativo' : gerar(), op,
      u.id, u.nome, ip(), iso(atras(0, 300)))
  } else {
    const cid2 = inteiro(rng, 1, QTD_CLIENTES)
    const c = db.prepare('select razao_social, empresa_id from clientes where id=?').get(cid2)
    const [campo, gerar] = escolher(rng, CAMPOS_CLI)
    stAud.run(c.empresa_id, 'clientes', cid2, c.razao_social, op === 'inclusao' ? '—' : campo,
      op === 'inclusao' ? null : gerar(), op === 'inativacao' ? 'inativo' : gerar(), op,
      u.id, u.nome, ip(), iso(atras(0, 300)))
  }
  totalAud++
}
passo(`${totalAud} lançamentos de auditoria`)

db.exec('commit')
db.exec('analyze')

// ---------------------------------------------------------------- resumo
const cnt = (t) => db.prepare(`select count(*) c from ${t}`).get().c
console.log('\n  ┌─────────────────────────────────────────────────┐')
console.log('  │  BASE DEMONSTRATIVA SUPRA — CARGA CONCLUÍDA     │')
console.log('  └─────────────────────────────────────────────────┘')
for (const t of ['empresas', 'usuarios', 'unidades', 'classificacoes', 'materiais', 'fornecedores',
  'fornecedor_grupos', 'clientes', 'transportadoras', 'demandas', 'demanda_itens', 'cotacoes',
  'cotacao_itens', 'cotacao_fornecedores', 'propostas', 'proposta_itens', 'agendamentos',
  'disparo_logs', 'erp_conectores', 'erp_eventos', 'auditoria']) {
  console.log(`   ${t.padEnd(24)} ${String(cnt(t)).padStart(9)}`)
}
const total = ['materiais', 'fornecedores', 'clientes', 'transportadoras', 'proposta_itens', 'auditoria',
  'cotacao_itens', 'demanda_itens', 'usuarios', 'erp_eventos'].reduce((s, t) => s + cnt(t), 0)
console.log(`   ${'—'.repeat(24)} ${'—'.repeat(9)}`)
console.log(`   ${'registros principais'.padEnd(24)} ${String(total).padStart(9)}`)
console.log(`\n  arquivo: data/supra.db\n`)
db.close()
