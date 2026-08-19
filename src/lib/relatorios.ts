// =====================================================================
// Consolidacao dos relatorios.
//
// Uma funcao so, chamada pela tela e pela exportacao CSV: o numero que
// aparece no grafico e exatamente o que sai na planilha. Se cada lado
// montasse a propria consulta, mais cedo ou mais tarde divergiriam — e a
// discussao na reuniao passaria a ser sobre qual dos dois esta certo.
//
// Datas sao texto ISO em ambos os bancos, entao comparar com `>=` e agrupar
// com substr(…,1,7) funciona igual no SQLite e no PostgreSQL. As diferencas
// de dialeto para datas ficam de fora: o que exige aritmetica de tempo e
// calculado em JavaScript sobre os pares ja lidos.
// =====================================================================
import { todos, um } from './db'
import { economiaConsolidada } from './consultas'

export const PERIODOS = [
  { valor: '30',  curto: '30 dias',  rotulo: 'Últimos 30 dias' },
  { valor: '90',  curto: '90 dias',  rotulo: 'Últimos 90 dias' },
  { valor: '180', curto: '6 meses',  rotulo: 'Últimos 6 meses' },
  { valor: '365', curto: '12 meses', rotulo: 'Últimos 12 meses' },
  { valor: '0',   curto: 'Tudo',     rotulo: 'Todo o histórico' },
]

/** Normaliza o parametro da URL: qualquer coisa fora da lista cai em 90 dias. */
export function periodoDe(bruto: string | undefined): number {
  return PERIODOS.some((p) => p.valor === bruto) ? Number(bruto) : 90
}

export type Serie = { rotulo: string; valor: number }

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-08" → "ago/26". Rótulo curto o bastante para caber no eixo. */
export function rotuloMes(ym: string): string {
  const [a, m] = ym.split('-')
  return `${MES_CURTO[Number(m) - 1] ?? m}/${a.slice(2)}`
}

/**
 * Completa os meses sem registro.
 * Sem isso um mês parado some do eixo e a série fica com o passo irregular —
 * que é justamente o mês que a gestão precisa enxergar.
 */
function preencherMeses(bruto: Array<{ m: string; c: number }>, desde: Date, ate: Date): Serie[] {
  const mapa = new Map(bruto.map((b) => [b.m, Number(b.c)]))
  const saida: Serie[] = []
  const cur = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1))
  const fim = new Date(Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth(), 1))

  // Teto de 36 colunas — mais que isso não cabe legível num eixo. O corte é
  // no começo, nunca no fim: quem abre o histórico completo quer sobretudo
  // ver o mês passado, e truncar pelo fim tiraria justamente ele.
  const meses = (fim.getUTCFullYear() - cur.getUTCFullYear()) * 12 + (fim.getUTCMonth() - cur.getUTCMonth())
  if (meses >= 36) cur.setUTCMonth(cur.getUTCMonth() + (meses - 35))

  while (cur <= fim) {
    const ym = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}`
    saida.push({ rotulo: rotuloMes(ym), valor: mapa.get(ym) ?? 0 })
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }
  return saida
}

export type Relatorio = Awaited<ReturnType<typeof relatorio>>

export async function relatorio(eid: number | null, dias: number) {
  const agora = new Date()
  const desde = dias > 0
    ? new Date(agora.getTime() - dias * 86_400_000)
    : new Date(Date.UTC(agora.getUTCFullYear() - 3, agora.getUTCMonth(), 1))
  const iso = desde.toISOString()

  const emp = eid ? 'and c.empresa_id = ?' : ''
  const pe = eid ? [eid] : []
  const p: Array<string | number> = [...pe, iso]

  /* ------------------------------------------------------------- volume -- */

  const cotMes = await todos<{ m: string; c: number | string }>(
    `select substr(c.criado_em, 1, 7) m, count(*) c from cotacoes c
      where c.criado_em >= ? ${eid ? 'and c.empresa_id = ?' : ''}
      group by substr(c.criado_em, 1, 7) order by 1`, eid ? [iso, eid] : [iso])

  const demMes = await todos<{ m: string; c: number | string }>(
    `select substr(d.criado_em, 1, 7) m, count(*) c from demandas d
      where d.criado_em >= ? ${eid ? 'and d.empresa_id = ?' : ''}
      group by substr(d.criado_em, 1, 7) order by 1`, eid ? [iso, eid] : [iso])

  const cotacoesPorMes = preencherMeses(cotMes.map((r) => ({ m: r.m, c: Number(r.c) })), desde, agora)
  const demandasPorMes = preencherMeses(demMes.map((r) => ({ m: r.m, c: Number(r.c) })), desde, agora)

  /* -------------------------------------------------------- composicao --- */

  const porStatus = await todos<{ status: string; c: number | string }>(
    `select c.status, count(*) c from cotacoes c
      where c.criado_em >= ? ${emp} group by c.status`, [iso, ...pe])

  const porOrigem = await todos<{ origem: string; c: number | string }>(
    `select d.origem, count(*) c from demandas d
      where d.criado_em >= ? ${eid ? 'and d.empresa_id = ?' : ''}
      group by d.origem`, eid ? [iso, eid] : [iso])

  const porCanal = await todos<{ canal: string; c: number | string }>(
    `select c.canal, count(*) c from cotacoes c
      where c.criado_em >= ? ${emp} group by c.canal`, [iso, ...pe])

  /* ---------------------------------------------------------- respostas -- */

  const convites = await todos<{ status: string; convidado_em: string; respondido_em: string | null }>(
    `select cf.status, cf.convidado_em, cf.respondido_em
       from cotacao_fornecedores cf join cotacoes c on c.id = cf.cotacao_id
      where cf.convidado_em >= ? ${emp} limit 20000`, [iso, ...pe])

  const respondidos = convites.filter((x) => x.status === 'respondido')
  const horas = respondidos
    .filter((x) => x.respondido_em)
    .map((x) => (new Date(x.respondido_em as string).getTime() - new Date(x.convidado_em).getTime()) / 3_600_000)
    .filter((h) => h >= 0 && h < 24 * 90)
    .sort((a, b) => a - b)

  const respostaMediana = horas.length ? horas[Math.floor(horas.length / 2)] : 0
  const respostaMedia = horas.length ? horas.reduce((t, h) => t + h, 0) / horas.length : 0

  const situacaoConvite = ['respondido', 'visualizado', 'convidado', 'recusado', 'expirado']
    .map((st) => ({ rotulo: rotuloConvite(st), valor: convites.filter((c) => c.status === st).length }))
    .filter((f) => f.valor > 0)

  /* ------------------------------------------------------- fornecedores -- */

  const topFornecedores = await todos<{ id: number; nome: string; convites: number | string; respostas: number | string; avaliacao: number }>(
    `select f.id, f.razao_social as nome, f.avaliacao,
            count(*) convites,
            sum(case when cf.status = 'respondido' then 1 else 0 end) respostas
       from cotacao_fornecedores cf
       join cotacoes c on c.id = cf.cotacao_id
       join fornecedores f on f.id = cf.fornecedor_id
      where cf.convidado_em >= ? ${emp}
      group by f.id, f.razao_social, f.avaliacao
      order by count(*) desc limit 8`, [iso, ...pe])

  /* ---------------------------------------------------------- materiais -- */

  const topMateriais = await todos<{ id: number; descricao: string; codigo: string; curva: string; rodadas: number | string; valor: number | null }>(
    `select m.id, m.descricao, m.codigo, m.curva,
            count(distinct ci.cotacao_id) rodadas,
            sum(ci.quantidade * m.preco_referencia) valor
       from cotacao_itens ci
       join cotacoes c on c.id = ci.cotacao_id
       join materiais m on m.id = ci.material_id
      where c.criado_em >= ? ${emp}
      group by m.id, m.descricao, m.codigo, m.curva
      order by sum(ci.quantidade * m.preco_referencia) desc limit 8`, [iso, ...pe])

  const porCurva = await todos<{ curva: string; c: number | string; valor: number | null }>(
    `select m.curva, count(*) c, sum(ci.quantidade * m.preco_referencia) valor
       from cotacao_itens ci
       join cotacoes c on c.id = ci.cotacao_id
       join materiais m on m.id = ci.material_id
      where c.criado_em >= ? ${emp} group by m.curva order by m.curva`, [iso, ...pe])

  /* ----------------------------------------------------------- economia -- */

  // A apuração de economia percorre a equalização de cada rodada — mesma
  // rotina do painel, para o número bater nas duas telas.
  const eco = await economiaConsolidada(eid)
  const datas = await todos<{ id: number; encerrado_em: string | null; criado_em: string }>(
    `select c.id, c.encerrado_em, c.criado_em from cotacoes c
      where c.status = 'equalizada' ${emp}`, pe)
  const quando = new Map(datas.map((d) => [d.id, d.encerrado_em ?? d.criado_em]))

  const noPeriodo = eco.porCotacao.filter((c) => {
    const t = quando.get(c.id)
    return t !== undefined && t >= iso
  })

  const economiaMes = new Map<string, number>()
  const referenciaMes = new Map<string, number>()
  for (const c of noPeriodo) {
    const ym = (quando.get(c.id) as string).slice(0, 7)
    economiaMes.set(ym, (economiaMes.get(ym) ?? 0) + (c.referencia - c.melhor))
    referenciaMes.set(ym, (referenciaMes.get(ym) ?? 0) + c.referencia)
  }
  const economiaPorMes = preencherMeses(
    [...economiaMes].map(([m, v]) => ({ m, c: Math.round(v) })), desde, agora)

  const referencia = noPeriodo.reduce((t, c) => t + c.referencia, 0)
  const contratado = noPeriodo.reduce((t, c) => t + c.melhor, 0)
  const global = noPeriodo.reduce((t, c) => t + c.global, 0)

  const ranking = [...noPeriodo].sort((a, b) => (b.referencia - b.melhor) - (a.referencia - a.melhor)).slice(0, 8)

  /* --------------------------------------------------------- integracao -- */

  const disparos = await todos<{ destinatarios: number | string; entregues: number | string; falhas: number | string; origem: string }>(
    `select dl.destinatarios, dl.entregues, dl.falhas, dl.origem from disparo_logs dl
      where dl.criado_em >= ? ${eid ? 'and dl.empresa_id = ?' : ''}`, eid ? [iso, eid] : [iso])

  const enviados = disparos.reduce((t, d) => t + Number(d.destinatarios), 0)
  const entregues = disparos.reduce((t, d) => t + Number(d.entregues), 0)
  const falhas = disparos.reduce((t, d) => t + Number(d.falhas), 0)
  const automaticos = disparos.filter((d) => d.origem === 'agendamento').length

  /* -------------------------------------------------------------- base -- */

  const cadastro = await um<{ materiais: number; fornecedores: number; homologados: number }>(
    `select
       (select count(*) from materiais where ativo = 1 ${eid ? 'and (empresa_id is null or empresa_id = ?)' : ''}) materiais,
       (select count(*) from fornecedores where ativo = 1 ${eid ? 'and (empresa_id is null or empresa_id = ?)' : ''}) fornecedores,
       (select count(*) from fornecedores where ativo = 1 and homologado = 1 ${eid ? 'and (empresa_id is null or empresa_id = ?)' : ''}) homologados`,
    eid ? [eid, eid, eid] : [])

  return {
    desde: iso,
    dias,
    cotacoesPorMes,
    demandasPorMes,
    economiaPorMes,
    porStatus: porStatus.map((r) => ({ rotulo: rotuloStatus(r.status), valor: Number(r.c) })),
    porOrigem: porOrigem.map((r) => ({ rotulo: rotuloOrigem(r.origem), valor: Number(r.c) })),
    porCanal: porCanal.map((r) => ({ rotulo: rotuloCanal(r.canal), valor: Number(r.c) })),
    porCurva: porCurva.map((r) => ({ curva: r.curva, itens: Number(r.c), valor: Number(r.valor ?? 0) })),
    situacaoConvite,
    convites: convites.length,
    respondidos: respondidos.length,
    taxaResposta: convites.length ? respondidos.length / convites.length : 0,
    respostaMediana,
    respostaMedia,
    topFornecedores: topFornecedores.map((f) => ({
      id: f.id, nome: f.nome, avaliacao: f.avaliacao,
      convites: Number(f.convites), respostas: Number(f.respostas),
      taxa: Number(f.convites) ? Number(f.respostas) / Number(f.convites) : 0,
    })),
    topMateriais: topMateriais.map((m) => ({
      id: m.id, descricao: m.descricao, codigo: m.codigo, curva: m.curva,
      rodadas: Number(m.rodadas), valor: Number(m.valor ?? 0),
    })),
    equalizadas: noPeriodo.length,
    referencia,
    contratado,
    economiaValor: referencia - contratado,
    economiaPct: referencia > 0 ? 1 - contratado / referencia : 0,
    ganhoPulverizacao: Math.max(0, global - contratado),
    ranking,
    enviados, entregues, falhas, automaticos,
    disparos: disparos.length,
    materiais: Number(cadastro?.materiais ?? 0),
    fornecedores: Number(cadastro?.fornecedores ?? 0),
    homologados: Number(cadastro?.homologados ?? 0),
  }
}

/* ------------------------------------------------------------- rotulos --- */

export const rotuloStatus = (s: string) => ({
  rascunho: 'Rascunho', programada: 'Programada', em_andamento: 'Em andamento',
  encerrada: 'Encerrada', equalizada: 'Equalizada', cancelada: 'Cancelada',
}[s] ?? s)

export const rotuloOrigem = (s: string) => ({
  requisicao: 'Requisição interna', estoque_minimo: 'Estoque mínimo',
  manual: 'Lançamento manual', erp: 'Integração ERP',
}[s] ?? s)

export const rotuloCanal = (s: string) => ({
  email: 'Somente e-mail', portal: 'Somente portal', ambos: 'E-mail e portal',
}[s] ?? s)

export const rotuloConvite = (s: string) => ({
  convidado: 'Aguardando', visualizado: 'Visualizou', respondido: 'Respondeu',
  recusado: 'Recusou', expirado: 'Expirou',
}[s] ?? s)
