// =====================================================================
// Porta unica de gravacao dos cadastros.
//
// Um endereco para as sete entidades, porque o que muda entre elas esta na
// especificacao, nao no fluxo: identificar quem e, conferir se pode, validar,
// gravar, auditar, redirecionar. Duplicar isso sete vezes garantiria que uma
// das copias esquecesse a checagem de perfil.
//
// Responde sempre com redirecionamento (303): o formulario e HTML puro, e o
// POST-redirect-GET evita que recarregar a pagina grave de novo.
// =====================================================================
import { sessao, podeVer } from '@/lib/sessao'
import { specDe, podeGravar } from '@/lib/registros'
import {
  lerFormulario, criarRegistro, editarRegistro, alternarColuna, excluirRegistro,
} from '@/lib/gravar'
import { redirecionar, caminhoInterno, origemPropria } from '@/lib/http'
import { guardarRecado } from '@/lib/flash'

export const dynamic = 'force-dynamic'

/** Cliente real atras do proxy; so para a trilha de auditoria. */
function ipDe(req: Request): string {
  const enc = req.headers.get('x-forwarded-for')
  return (enc ? enc.split(',')[0] : req.headers.get('x-real-ip') ?? '').trim() || 'interno'
}

/** Volta ao formulario com o que foi digitado e o motivo da recusa. */
function comRecado(
  destino: string, erros: Record<string, string>, valores: Record<string, string | number | null>
) {
  const res = redirecionar(destino, 303)
  const carimbo = guardarRecado(res, erros, valores)
  const sep = destino.includes('?') ? '&' : '?'
  res.headers.set('location', `${destino}${sep}f=${carimbo}`)
  return res
}

export async function POST(req: Request, { params }: { params: { entidade: string } }) {
  if (!origemPropria(req)) return new Response('Origem inválida', { status: 403 })

  const spec = specDe(params.entidade)
  if (!spec) return new Response('Não encontrado', { status: 404 })

  const s = await sessao()
  // Mesma regra da navegacao: quem nao ve a area nao existe para ela. A
  // resposta e 404, e nao 403, para nao confirmar o que ha do outro lado.
  if (!podeVer(s.perfil, spec.area) || !podeGravar(spec, s.perfil)) {
    return new Response('Não encontrado', { status: 404 })
  }

  const form = await req.formData()
  const op = String(form.get('_op') ?? '')
  const id = Number(form.get('_id') ?? 0) || 0
  const voltar = caminhoInterno(String(form.get('_voltar') ?? ''), spec.base)
  const autor = { s, ip: ipDe(req) }

  const depoisDeGravar = (novoId: number, verbo: 'criado' | 'salvo') =>
    spec.temDetalhe
      ? `${spec.base}/${novoId}?ok=${verbo}`
      : `${voltar}${voltar.includes('?') ? '&' : '?'}ok=${verbo}`

  switch (op) {
    case 'criar': {
      const { valores, erros } = lerFormulario(spec, form, 'criar')
      if (Object.keys(erros).length) return comRecado(`${spec.base}/novo`, erros, valores)

      const r = await criarRegistro(spec, autor, valores)
      if (!r.ok) return comRecado(`${spec.base}/novo`, r.erros, r.valores)
      return redirecionar(depoisDeGravar(r.id, 'criado'), 303)
    }

    case 'editar': {
      if (!id) return new Response('Registro não informado', { status: 400 })
      const { valores, erros } = lerFormulario(spec, form, 'editar')
      if (Object.keys(erros).length) return comRecado(`${spec.base}/${id}/editar`, erros, valores)

      const r = await editarRegistro(spec, autor, id, valores)
      if (!r.ok) return comRecado(`${spec.base}/${id}/editar`, r.erros, r.valores)
      return redirecionar(depoisDeGravar(id, 'salvo'), 303)
    }

    case 'alternar': {
      if (!id) return new Response('Registro não informado', { status: 400 })
      const coluna = String(form.get('_coluna') ?? 'ativo')
      if (coluna !== 'ativo' && coluna !== 'homologado') {
        return new Response('Coluna inválida', { status: 400 })
      }
      const ligar = String(form.get('_valor') ?? '') === '1'
      const r = await alternarColuna(spec, autor, id, coluna, ligar)
      if (!r.ok) return comRecado(voltar, { _: r.erro ?? 'Não foi possível alterar.' }, {})

      const marca = coluna === 'ativo' ? (ligar ? 'reativado' : 'inativado') : (ligar ? 'homologado' : 'suspenso')
      return redirecionar(`${voltar}${voltar.includes('?') ? '&' : '?'}ok=${marca}`, 303)
    }

    case 'excluir': {
      if (!id) return new Response('Registro não informado', { status: 400 })
      const r = await excluirRegistro(spec, autor, id)
      if (!r.ok) return comRecado(voltar, { _: r.erro ?? 'Não foi possível excluir.' }, {})
      return redirecionar(`${voltar}${voltar.includes('?') ? '&' : '?'}ok=excluido`, 303)
    }

    default:
      return new Response('Operação inválida', { status: 400 })
  }
}
