// =====================================================================
// Acoes de e-mail: teste de configuracao, reenvio de convite e lembrete.
//
// Mesmo desenho das outras gravacoes — POST de formulario, resposta 303,
// recusa volta como faixa vermelha na tela de origem. Nenhuma delas grava
// cadastro; todas produzem trafego de saida, e por isso passam pelas mesmas
// duas guardas: origem propria e perfil com direito a area.
// =====================================================================
import { randomBytes } from 'node:crypto'
import { sessao, podeVer } from '@/lib/sessao'
import { redirecionar, origemPropria, caminhoInterno } from '@/lib/http'
import { guardarRecado } from '@/lib/flash'
import { um } from '@/lib/db'
import { enviar, configuracao, enderecoValido } from '@/lib/email'
import { teste } from '@/lib/mensagens'
import { enviarConvites, emSegundoPlano, baseDe } from '@/lib/disparo'

export const dynamic = 'force-dynamic'

const so = (v: FormDataEntryValue | null) => String(v ?? '').trim()

function recusar(voltar: string, erro: string) {
  const destino = caminhoInterno(voltar, '/emails')
  const res = redirecionar(destino, 303)
  const carimbo = guardarRecado(res, { _: erro }, {})
  res.headers.set('location', `${destino}${destino.includes('?') ? '&' : '?'}f=${carimbo}`)
  return res
}

export async function POST(req: Request) {
  if (!origemPropria(req)) return new Response('Origem inválida', { status: 403 })

  const f = await req.formData()
  const op = so(f.get('_op'))
  const voltar = so(f.get('_voltar')) || '/emails'

  const s = await sessao()
  if (!podeVer(s.perfil, 'emails')) return new Response('Não encontrado', { status: 404 })
  if (s.perfil === 'fornecedor') return new Response('Não encontrado', { status: 404 })

  /* ------------------------------------------------------------- teste -- */
  if (op === 'teste') {
    const para = so(f.get('para'))
    if (!enderecoValido(para)) return recusar(voltar, 'Informe um endereço de e-mail válido.')

    const c = configuracao()
    if (!c.pronto) {
      return recusar(voltar, 'SMTP não configurado. ' + c.problemas.join(' '))
    }

    const marca = randomBytes(4).toString('hex').toUpperCase()
    const m = teste(marca, c.base || baseDe(req), s.usuario.nome)

    // Aqui o envio e aguardado, ao contrario do disparo: uma mensagem leva
    // uns dois segundos e o resultado e justamente o que a pessoa veio ver.
    // Entregar a tela antes da resposta do servidor tornaria o teste inutil.
    const r = await enviar({
      para, assunto: m.assunto, texto: m.texto, html: m.html,
      tipo: 'teste', empresaId: s.empresa?.id ?? null,
      // Endereco digitado a mao por quem esta autenticado: o modo nao se
      // aplica. Redirecionar ou simular um teste nao testaria nada.
      direto: true,
    })

    if (!r.ok) return recusar(voltar, `Falha no envio: ${r.erro ?? 'motivo não informado'}`)
    return redirecionar('/emails?ok=teste_enviado', 303)
  }

  /* ------------------------------------------- reenvio de convite / lembrete */
  if (op === 'reenviar' || op === 'lembrete') {
    if (!podeVer(s.perfil, 'cotacoes')) return new Response('Não encontrado', { status: 404 })

    const id = Number(so(f.get('_id')))
    if (!Number.isInteger(id) || id <= 0) return recusar(voltar, 'Cotação inválida.')

    const c = await um<{ id: number; empresa_id: number; status: string }>(
      'select id, empresa_id, status from cotacoes where id = ?', [id])
    if (!c) return recusar(voltar, 'Cotação não encontrada.')
    // Fronteira entre inquilinos: trocar o id na URL nao atravessa empresa.
    if (s.empresa && s.empresa.id !== c.empresa_id) return new Response('Não encontrado', { status: 404 })
    if (c.status !== 'em_andamento') {
      return recusar(voltar, 'Só uma rodada em andamento aceita reenvio — dispare a cotação primeiro.')
    }

    emSegundoPlano(() => enviarConvites({
      cotacaoId: c.id,
      base: baseDe(req),
      tipo: op === 'lembrete' ? 'lembrete' : 'convite',
      // Quem ja respondeu nao precisa ser lembrado nem reconvidado; insistir
      // com quem cumpriu o pedido e a forma mais rapida de virar spam.
      somentePendentes: true,
    }))

    return redirecionar(`/cotacoes/${c.id}?ok=${op === 'lembrete' ? 'lembrete' : 'reenviado'}`, 303)
  }

  return new Response('Operação inválida', { status: 400 })
}
