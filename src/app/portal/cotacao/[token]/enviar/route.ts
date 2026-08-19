import { um, todos, executar, inserirRetornandoId, transacao } from '@/lib/db'
import { redirecionar } from '@/lib/http'
import { PRAZO_DE } from '@/lib/opcoes'

/**
 * Recebimento da proposta pelo portal externo.
 * A proposta e gravada e passa a compor a equalizacao imediatamente —
 * nao ha redigitacao pela equipe de compras.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const form = await req.formData()

  const convite = await um<{ id: number; cotacao_id: number; fornecedor_id: number; cot_status: string }>(
    `select cf.id, cf.cotacao_id, cf.fornecedor_id, c.status as cot_status
       from cotacao_fornecedores cf join cotacoes c on c.id = cf.cotacao_id
      where cf.token = ?`, [params.token])

  if (!convite) {
    return redirecionar('/portal')
  }
  const destino = `/portal/cotacao/${params.token}`

  // Nao aceita proposta em cotacao encerrada nem duplicidade de envio.
  const jaEnviou = await um<{ id: number }>(
    'select id from propostas where cotacao_id = ? and fornecedor_id = ?',
    [convite.cotacao_id, convite.fornecedor_id])
  if (jaEnviou || convite.cot_status !== 'em_andamento') {
    return redirecionar(destino)
  }

  const itens = await todos<{ id: number }>(
    'select id from cotacao_itens where cotacao_id = ?', [convite.cotacao_id])

  const num = (nome: string, padrao = 0) => {
    const v = Number(String(form.get(nome) ?? '').replace(',', '.'))
    return Number.isFinite(v) ? v : padrao
  }
  const txt = (nome: string) => String(form.get(nome) ?? '').trim()

  const freteTipo = txt('frete_tipo') === 'FOB' ? 'FOB' : 'CIF'
  const condPagamento = txt('cond_pagamento') || '30 dias'
  const agora = new Date().toISOString()

  // Precisa haver ao menos um item com preco valido.
  const ofertados = itens.filter((it) => form.get(`disp_${it.id}`) === '1' && num(`preco_${it.id}`) > 0)
  if (ofertados.length === 0) {
    return redirecionar(`${destino}?erro=sem-precos`)
  }

  await transacao(async () => {
    const propostaId = await inserirRetornandoId(
      `insert into propostas
        (cotacao_id, fornecedor_id, frete_tipo, valor_frete, prazo_entrega_dias, cond_pagamento,
         prazo_pagamento_dias, desconto_pct, validade_dias, observacoes, enviada_em)
       values (?,?,?,?,?,?,?,?,?,?,?)`,
      [convite.cotacao_id, convite.fornecedor_id, freteTipo,
       freteTipo === 'FOB' ? Math.max(0, num('valor_frete')) : 0,
       Math.max(1, Math.round(num('prazo_entrega', 15))), condPagamento, PRAZO_DE(condPagamento),
       Math.min(90, Math.max(0, num('desconto'))), Math.max(1, Math.round(num('validade', 30))),
       txt('observacoes') || null, agora])

    for (const it of itens) {
      const disponivel = form.get(`disp_${it.id}`) === '1'
      const preco = num(`preco_${it.id}`)
      const valido = disponivel && preco > 0
      await executar(
        `insert into proposta_itens
          (proposta_id, cotacao_item_id, preco_unitario, ipi_pct, icms_st_pct, marca, prazo_item_dias, disponivel)
         values (?,?,?,?,?,?,?,?)`,
        [propostaId, it.id, valido ? preco : 0, Math.max(0, num(`ipi_${it.id}`)), 0,
         txt(`marca_${it.id}`) || null, null, valido ? 1 : 0])
    }

    await executar(`update cotacao_fornecedores set status = 'respondido', respondido_em = ? where id = ?`,
      [agora, convite.id])
  })

  return redirecionar(`${destino}?enviada=1`)
}
