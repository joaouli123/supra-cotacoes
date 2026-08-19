// =====================================================================
// Exportacao dos relatorios em CSV.
//
// Sai do mesmo `relatorio()` que desenha a tela — nao ha uma segunda
// consulta que possa divergir. O arquivo carrega todos os blocos da
// pagina, em secoes nomeadas, para quem vai continuar a analise na
// planilha.
//
// Formato pensado para o Excel em portugues: separador ponto-e-virgula,
// decimal com virgula e BOM no inicio, senao acento vira caractere solto.
// =====================================================================
import { sessao, podeVer } from '@/lib/sessao'
import { relatorio, periodoDe, PERIODOS } from '@/lib/relatorios'

export const dynamic = 'force-dynamic'

/** Escapa um campo para CSV. Sempre entre aspas: campo com ; ou quebra nao vaza. */
function campo(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '""'
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '""'
    // Contagem sai inteira; valor e percentual saem com duas casas e virgula
    // decimal — "12,00 rodadas" numa planilha parece erro de conversao.
    if (Number.isInteger(v)) return `"${v}"`
    return `"${v.toFixed(2).replace('.', ',')}"`
  }
  return `"${String(v).replace(/"/g, '""')}"`
}

const linha = (...cs: Array<string | number | null | undefined>) => cs.map(campo).join(';')

export async function GET(req: Request) {
  const s = await sessao()
  // Mesma regra da pagina: quem nao ve o relatorio nao baixa o relatorio.
  if (!podeVer(s.perfil, 'relatorios')) return new Response('Não encontrado', { status: 404 })

  const url = new URL(req.url)
  const dias = periodoDe(url.searchParams.get('periodo') ?? undefined)
  const rotulo = PERIODOS.find((p) => p.valor === String(dias))?.rotulo ?? ''

  const eid = s.empresa?.id ?? null
  const r = await relatorio(eid, dias)

  const l: string[] = []
  const secao = (t: string) => { l.push(''); l.push(linha(t)) }

  l.push(linha('SUPRA — Relatório de suprimentos'))
  l.push(linha('Empresa', s.empresa?.razao_social ?? 'Consolidado da plataforma'))
  l.push(linha('Período', rotulo))
  l.push(linha('Início da apuração', r.desde.slice(0, 10)))
  l.push(linha('Emitido em', new Date().toISOString().slice(0, 16).replace('T', ' ')))
  l.push(linha('Emitido por', s.usuario.nome))

  secao('RESUMO')
  l.push(linha('Indicador', 'Valor'))
  l.push(linha('Valor de referência (R$)', r.referencia))
  l.push(linha('Valor contratado (R$)', r.contratado))
  l.push(linha('Economia apurada (R$)', r.economiaValor))
  l.push(linha('Redução sobre a referência (%)', r.economiaPct * 100))
  l.push(linha('Ganho por pulverização (R$)', r.ganhoPulverizacao))
  l.push(linha('Rodadas equalizadas', r.equalizadas))
  l.push(linha('Convites enviados', r.convites))
  l.push(linha('Propostas recebidas', r.respondidos))
  l.push(linha('Taxa de resposta (%)', r.taxaResposta * 100))
  l.push(linha('Resposta mediana (horas)', r.respostaMediana))
  l.push(linha('Resposta média (horas)', r.respostaMedia))
  l.push(linha('Destinatários de disparo', r.enviados))
  l.push(linha('Entregues', r.entregues))
  l.push(linha('Falhas de entrega', r.falhas))
  l.push(linha('Disparos automáticos', r.automaticos))
  l.push(linha('Materiais ativos', r.materiais))
  l.push(linha('Fornecedores ativos', r.fornecedores))
  l.push(linha('Fornecedores homologados', r.homologados))

  secao('VOLUME MENSAL')
  l.push(linha('Mês', 'Cotações abertas', 'Requisições recebidas', 'Economia do mês (R$)'))
  r.cotacoesPorMes.forEach((m, i) => l.push(linha(
    m.rotulo, m.valor,
    r.demandasPorMes[i]?.valor ?? 0,
    r.economiaPorMes[i]?.valor ?? 0)))

  secao('SITUAÇÃO DAS RODADAS')
  l.push(linha('Situação', 'Rodadas'))
  r.porStatus.forEach((f) => l.push(linha(f.rotulo, f.valor)))

  secao('ORIGEM DAS REQUISIÇÕES')
  l.push(linha('Origem', 'Requisições'))
  r.porOrigem.forEach((f) => l.push(linha(f.rotulo, f.valor)))

  secao('CANAL DE DISPARO')
  l.push(linha('Canal', 'Rodadas'))
  r.porCanal.forEach((f) => l.push(linha(f.rotulo, f.valor)))

  secao('RETORNO DOS CONVITES')
  l.push(linha('Situação', 'Convites'))
  r.situacaoConvite.forEach((f) => l.push(linha(f.rotulo, f.valor)))

  secao('FORNECEDORES MAIS ACIONADOS')
  l.push(linha('Fornecedor', 'Convites', 'Respostas', 'Retorno (%)', 'Avaliação'))
  r.topFornecedores.forEach((f) => l.push(linha(f.nome, f.convites, f.respostas, f.taxa * 100, f.avaliacao)))

  secao('MATERIAIS DE MAIOR VALOR COTADO')
  l.push(linha('Código', 'Material', 'Curva', 'Rodadas', 'Valor de referência (R$)'))
  r.topMateriais.forEach((m) => l.push(linha(m.codigo, m.descricao, m.curva, m.rodadas, m.valor)))

  secao('CONCENTRAÇÃO POR CURVA ABC')
  l.push(linha('Curva', 'Linhas cotadas', 'Valor de referência (R$)'))
  r.porCurva.forEach((c) => l.push(linha(c.curva, c.itens, c.valor)))

  secao('RODADAS COM MAIOR RETORNO')
  l.push(linha('Cotação', 'Título', 'Referência (R$)', 'Contratado (R$)', 'Economia (R$)', 'Redução (%)'))
  r.ranking.forEach((c) => l.push(linha(
    c.numero, c.titulo, c.referencia, c.melhor, c.referencia - c.melhor,
    c.referencia > 0 ? ((c.referencia - c.melhor) / c.referencia) * 100 : 0)))

  // CRLF e BOM: o Excel abre direto, sem passar pelo assistente de importacao.
  const csv = '﻿' + l.join('\r\n') + '\r\n'
  const nome = `supra-relatorio-${dias > 0 ? `${dias}d` : 'completo'}-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${nome}"`,
      'cache-control': 'no-store',
    },
  })
}
