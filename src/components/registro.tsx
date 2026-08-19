// =====================================================================
// Telas de cadastro e edicao, uma implementacao para todas as entidades.
//
// Cada rota (`/materiais/novo`, `/clientes/12/editar`, …) e um arquivo de
// tres linhas que aponta para ca. O que difere entre elas ja esta na
// especificacao; repetir a mesma pagina sete vezes so criaria sete lugares
// onde esquecer a checagem de permissao.
// =====================================================================
import { notFound } from 'next/navigation'
import { um } from '@/lib/db'
import { exigir } from '@/lib/acesso'
import { specDe, podeGravar, type Especificacao } from '@/lib/registros'
import { opcoesDe, podeAlterar, type Valores } from '@/lib/gravar'
import { lerRecado } from '@/lib/flash'
import { CabecalhoPagina, Aviso } from './ui'
import { Formulario } from './Formulario'
import { IconeInfo, IconeMais, IconeLapis } from './icones'

type Busca = { [k: string]: string | undefined }

/** Onde a tela deve voltar depois de gravar ou cancelar. */
function destino(spec: Especificacao, busca: Busca) {
  const v = busca.voltar
  return v && v.startsWith('/') && !v.startsWith('//') ? v : spec.base
}

/** Frase que diz de quem sera o cadastro — a duvida mais comum na tela. */
function escopoTexto(spec: Especificacao, empresa: string | null): string | null {
  if (spec.escopo === 'plataforma') return null
  if (spec.escopo === 'empresa') {
    return empresa
      ? `Este cadastro pertence a ${empresa} e só é visível por ela.`
      : 'Selecione uma empresa no topo da tela antes de cadastrar.'
  }
  return empresa
    ? `Será cadastrado para ${empresa}. Itens do catálogo corporativo, visíveis por todas as empresas, são mantidos pela administração da plataforma.`
    : 'Sem empresa selecionada, o cadastro entra no catálogo corporativo e passa a ser visível por todas as empresas.'
}

/* ------------------------------------------------------------------ novo */
export async function PaginaNovo({ chave, searchParams }: { chave: string; searchParams: Busca }) {
  const spec = specDe(chave)
  if (!spec) notFound()

  const s = await exigir(spec.area)
  if (!podeGravar(spec, s.perfil)) notFound()

  const recado = lerRecado(searchParams.f)
  const opcoes = await opcoesDe(spec, s.empresa?.id ?? null)
  const aviso = escopoTexto(spec, s.empresa?.nome_fantasia ?? null)

  return (
    <>
      <CabecalhoPagina
        icone={<IconeMais size={19} />}
        migalhas={[{ rotulo: spec.plural, href: spec.base }, { rotulo: 'Novo' }]}
        titulo={`Novo ${spec.rotulo.toLowerCase()}`}
        descricao="Os campos marcados são obrigatórios. Toda inclusão fica registrada na trilha de auditoria."
      />

      {aviso && (
        <div className="mb-4">
          <Aviso icone={<IconeInfo size={16} />}>{aviso}</Aviso>
        </div>
      )}

      <Formulario
        spec={spec} modo="criar" opcoes={opcoes}
        valores={recado?.valores ?? {}} erros={recado?.erros ?? {}}
        voltar={destino(spec, searchParams)}
      />
    </>
  )
}

/* ---------------------------------------------------------------- editar */
export async function PaginaEditar(
  { chave, id, searchParams }: { chave: string; id: string; searchParams: Busca }
) {
  const spec = specDe(chave)
  if (!spec) notFound()

  const s = await exigir(spec.area)
  if (!podeGravar(spec, s.perfil)) notFound()

  const n = Number(id)
  if (!Number.isInteger(n) || n <= 0) notFound()

  const atual = await um<Record<string, unknown>>(`select * from ${spec.tabela} where id = ?`, [n])
  if (!atual) notFound()
  // Mesma regra da gravacao, aplicada antes de mostrar: sem isso a tela
  // exibiria dados de outro inquilino e so recusaria no envio.
  if (!podeAlterar(spec, s, (atual.empresa_id as number | null) ?? null)) notFound()

  const recado = lerRecado(searchParams.f)
  const opcoes = await opcoesDe(spec, s.empresa?.id ?? null)

  const doBanco: Valores = {}
  for (const c of spec.campos) {
    // Senha nunca volta para a tela, nem em hash.
    if (c.tipo === 'senha') continue
    const v = atual[c.coluna ?? c.nome]
    doBanco[c.nome] = v === null || v === undefined ? null : (v as string | number)
  }

  const rotulo = String(atual[spec.rotuloColuna] ?? spec.rotulo)

  return (
    <>
      <CabecalhoPagina
        icone={<IconeLapis size={19} />}
        migalhas={[
          { rotulo: spec.plural, href: spec.base },
          ...(spec.temDetalhe ? [{ rotulo, href: `${spec.base}/${n}` }] : []),
          { rotulo: 'Editar' },
        ]}
        titulo={rotulo}
        descricao="Cada campo alterado gera uma linha na auditoria, com o valor anterior e o novo."
      />

      <Formulario
        spec={spec} modo="editar" id={n} opcoes={opcoes}
        valores={{ ...doBanco, ...(recado?.valores ?? {}) }}
        erros={recado?.erros ?? {}}
        voltar={destino(spec, searchParams)}
      />
    </>
  )
}
