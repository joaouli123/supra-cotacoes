// =====================================================================
// Porta unica das acoes de fluxo — demandas e cotacoes.
//
// Irma da rota de cadastros, com uma diferenca de fundo: la o que se grava
// e um formulario de campos, aqui e uma transicao de estado. Por isso nao
// ha especificacao generica; cada operacao conhece de onde pode partir.
//
// Como toda gravacao do sistema: POST de formulario HTML, resposta 303,
// recusa volta como faixa vermelha na tela de origem.
// =====================================================================
import { sessao, podeVer } from '@/lib/sessao'
import { redirecionar, origemPropria } from '@/lib/http'
import { guardarRecado } from '@/lib/flash'
import type { Fim } from '@/lib/fluxo'
import {
  criarDemanda, adicionarItemDemanda, removerItemDemanda, mudarStatusDemanda,
  criarCotacao, adicionarItemCotacao, removerItemCotacao,
  convidarFornecedor, convidarAptos, removerConvite,
  dispararCotacao, mudarStatusCotacao,
} from '@/lib/fluxo'

export const dynamic = 'force-dynamic'

function ipDe(req: Request): string {
  const enc = req.headers.get('x-forwarded-for')
  return (enc ? enc.split(',')[0] : req.headers.get('x-real-ip') ?? '').trim() || 'interno'
}

/** Cada operacao declara a area que a pessoa precisa enxergar para executa-la. */
const OPERACOES = {
  'demanda.criar':      { area: 'demandas' as const, fn: criarDemanda },
  'demanda.item.add':   { area: 'demandas' as const, fn: adicionarItemDemanda },
  'demanda.item.rm':    { area: 'demandas' as const, fn: removerItemDemanda },
  'demanda.status':     { area: 'demandas' as const, fn: mudarStatusDemanda },
  'cotacao.criar':      { area: 'cotacoes' as const, fn: criarCotacao },
  'cotacao.item.add':   { area: 'cotacoes' as const, fn: adicionarItemCotacao },
  'cotacao.item.rm':    { area: 'cotacoes' as const, fn: removerItemCotacao },
  'cotacao.convidar':   { area: 'cotacoes' as const, fn: convidarFornecedor },
  'cotacao.aptos':      { area: 'cotacoes' as const, fn: convidarAptos },
  'cotacao.desconvidar':{ area: 'cotacoes' as const, fn: removerConvite },
  'cotacao.disparar':   { area: 'cotacoes' as const, fn: dispararCotacao },
  'cotacao.status':     { area: 'cotacoes' as const, fn: mudarStatusCotacao },
}

export async function POST(req: Request) {
  if (!origemPropria(req)) return new Response('Origem inválida', { status: 403 })

  const form = await req.formData()
  const op = String(form.get('_op') ?? '')
  const alvo = OPERACOES[op as keyof typeof OPERACOES]
  if (!alvo) return new Response('Operação inválida', { status: 400 })

  const s = await sessao()
  // Quem nao enxerga a area nao existe para ela: 404, e nao 403, para nao
  // confirmar o que ha do outro lado.
  if (!podeVer(s.perfil, alvo.area)) return new Response('Não encontrado', { status: 404 })
  // O portal do fornecedor responde propostas; nao conduz a rodada.
  if (s.perfil === 'fornecedor') return new Response('Não encontrado', { status: 404 })

  const r: Fim = await alvo.fn({ s, ip: ipDe(req) }, form)
  if (r.ok) return redirecionar(r.destino, 303)

  const voltar = String(form.get('_voltar') ?? '') || '/painel'
  const destino = voltar.startsWith('/') && !voltar.startsWith('//') ? voltar : '/painel'
  const res = redirecionar(destino, 303)
  const carimbo = guardarRecado(res, { _: r.erro }, {})
  res.headers.set('location', `${destino}${destino.includes('?') ? '&' : '?'}f=${carimbo}`)
  return res
}
