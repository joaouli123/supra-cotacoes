import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir, exigirEmpresa } from '@/lib/acesso'
import { um, todos } from '@/lib/db'
import { trilhaClassificacao } from '@/lib/consultas'
import { moeda, numero, data } from '@/lib/formato'
import { Painel, CabecalhoPagina, Campo, Vazio, Tag, Barra } from '@/components/ui'
import { IconeCaixa, IconeArvore, IconeGrafico, IconeDocumento, IconeRegua, IconeFabrica } from '@/components/icones'
import { AcoesDetalhe, Retorno, Recusa } from '@/components/Acoes'
import { REGISTROS } from '@/lib/registros'
import { lerRecado } from '@/lib/flash'

export const dynamic = 'force-dynamic'
const SPEC = REGISTROS.materiais
const NIVEIS = ['Grupo', 'Subgrupo', 'Família', 'Subfamília', 'Classe']

export default async function PaginaMaterial(
  { params, searchParams }: { params: { id: string }; searchParams: { [k: string]: string | undefined } }
) {
  const s = await exigir('cadastros')
  const id = Number(params.id)
  const m = await um<{
    id: number; codigo: string; descricao: string; especificacao: string; ncm: string
    preco_referencia: number; curva: string; estoque_minimo: number | null; ativo: number
    criado_em: string; atualizado_em: string; unidade: string; unidade_desc: string
    classificacao_id: number; empresa_id: number | null; empresa: string | null
  }>(
    `select m.*, un.sigla as unidade, un.descricao as unidade_desc, e.nome_fantasia as empresa
       from materiais m join unidades un on un.id = m.unidade_id
       left join empresas e on e.id = m.empresa_id where m.id = ?`, [id])
  if (!m) notFound()
  exigirEmpresa(s, m.empresa_id, true)

  const trilha = await trilhaClassificacao(m.classificacao_id)
  const grupoRaiz = trilha[0]

  const historico = await todos<{
    numero: string; cotacao_id: number; fornecedor: string; preco_unitario: number
    quantidade: number; enviada_em: string
  }>(
    `select c.numero, c.id as cotacao_id, f.razao_social as fornecedor, pi.preco_unitario,
            ci.quantidade, p.enviada_em
       from proposta_itens pi
       join propostas p on p.id = pi.proposta_id
       join cotacao_itens ci on ci.id = pi.cotacao_item_id
       join cotacoes c on c.id = ci.cotacao_id
       join fornecedores f on f.id = p.fornecedor_id
      where ci.material_id = ? and pi.disponivel = 1
      order by p.enviada_em desc limit 12`, [id])

  const aptos = (await um<{ c: number }>(
    `select count(distinct fg.fornecedor_id) c from fornecedor_grupos fg
      join fornecedores f on f.id = fg.fornecedor_id
     where fg.classificacao_id = (select id from classificacoes where nivel=1 and nome=?)
       and f.homologado = 1 and f.ativo = 1`, [grupoRaiz?.nome ?? '']))?.c ?? 0

  const precos = historico.map((h) => h.preco_unitario)
  const menor = precos.length ? Math.min(...precos) : 0
  const maior = precos.length ? Math.max(...precos) : 0

  return (
    <>
      <CabecalhoPagina
        migalhas={[{ rotulo: 'Materiais', href: '/materiais' }, { rotulo: m.codigo }]}
        icone={<IconeCaixa size={19} />}
        titulo={m.descricao}
        descricao={m.especificacao}
        acoes={<AcoesDetalhe spec={SPEC} id={m.id} ativo={m.ativo} voltar={`/materiais/${m.id}`} />}
      />

      <Retorno ok={searchParams.ok} />
      <Recusa mensagem={lerRecado(searchParams.f)?.erros._} />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-5">
        <div className="space-y-4 sm:space-y-5 min-w-0">
          {/* ------------------------------------- classificacao 5 niveis */}
          <Painel icone={<IconeArvore size={15} />} titulo="Classificação hierárquica">
            <ol className="space-y-0">
              {trilha.map((t, i) => (
                <li key={t.codigo} className="flex items-center gap-3 py-2" style={{ paddingLeft: `${i * 18}px` }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-300 shrink-0" />
                  <span className="text-2xs uppercase tracking-wider text-ink-400 w-20 shrink-0">{NIVEIS[t.nivel - 1]}</span>
                  <span className="texto-mono text-xs text-ink-500 shrink-0">{t.codigo}</span>
                  <span className="text-sm text-ink-900">{t.nome}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 pt-3 border-t border-ink-100 text-xs text-ink-500">
              <IconeFabrica size={13} className="inline text-ink-400 mr-1" />{numero(aptos)} fornecedores homologados atendem o grupo <strong className="text-ink-700 font-medium">{grupoRaiz?.nome}</strong>{' '}
              e seriam convidados automaticamente numa cotação deste item.
            </p>
          </Painel>

          {/* ------------------------------------- historico de precos */}
          <Painel semPadding icone={<IconeGrafico size={15} />} titulo="Preços já cotados"
            acao={precos.length > 0 && (
              <span className="text-xs text-ink-500 tabular">
                {moeda(menor)} — {moeda(maior)}
              </span>
            )}>
            {historico.length === 0 ? (
              <Vazio icone={<IconeGrafico size={20} />} titulo="Este material ainda não foi cotado" descricao="O histórico de preços aparece assim que ele entrar numa cotação." />
            ) : (
              <table className="tabela tabela-cartoes">
                <thead><tr><th>Cotação</th><th>Fornecedor</th><th className="num">Qtd.</th><th className="num">Preço unit.</th><th>Data</th></tr></thead>
                <tbody>
                  {historico.map((h, i) => (
                    <tr key={i}>
                      <td data-p><Link href={`/cotacoes/${h.cotacao_id}`}
                            className="texto-mono text-sm md:text-xs text-ink-800 md:text-ink-600 hover:text-petrol-700 font-medium md:font-normal">
                            {h.numero}</Link></td>
                      <td data-r="Fornecedor" className="text-sm text-ink-700 md:max-w-[240px] md:truncate">{h.fornecedor}</td>
                      <td data-r="Quantidade" className="num text-sm">{numero(h.quantidade)}</td>
                      <td data-r="Preço unit." className="num text-sm">
                        <span className={h.preco_unitario === menor ? 'font-semibold text-positive-700' : ''}>
                          {moeda(h.preco_unitario)}
                        </span>
                      </td>
                      <td data-r="Data" className="text-xs text-ink-500">{data(h.enviada_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Painel>
        </div>

        <aside className="space-y-4 sm:space-y-5">
          <Painel icone={<IconeDocumento size={15} />} titulo="Dados do item">
            <dl>
              <Campo rotulo="Código"><span className="texto-mono text-xs">{m.codigo}</span></Campo>
              <Campo rotulo="Unidade">{m.unidade} · {m.unidade_desc}</Campo>
              <Campo rotulo="NCM"><span className="texto-mono text-xs">{m.ncm}</span></Campo>
              <Campo rotulo="Preço de referência"><strong className="font-semibold">{moeda(m.preco_referencia)}</strong></Campo>
              <Campo rotulo="Curva ABC"><Tag variante={m.curva === 'A' ? 'ativa' : 'neutra'}>{m.curva}</Tag></Campo>
              <Campo rotulo="Estoque mínimo">{m.estoque_minimo ? numero(m.estoque_minimo) : '—'}</Campo>
              <Campo rotulo="Situação">
                <Tag variante={m.ativo ? 'positiva' : 'neutra'} ponto>{m.ativo ? 'Ativo' : 'Inativo'}</Tag>
              </Campo>
              <Campo rotulo="Origem">{m.empresa ?? 'Catálogo corporativo'}</Campo>
              <Campo rotulo="Cadastrado em">{data(m.criado_em)}</Campo>
              <Campo rotulo="Atualizado em">{data(m.atualizado_em)}</Campo>
            </dl>
          </Painel>

          {precos.length > 1 && (
            <Painel icone={<IconeRegua size={15} />} titulo="Dispersão de preços">
              <p className="text-sm text-ink-600">
                Entre as {precos.length} ofertas registradas, o maior preço é{' '}
                <strong className="text-ink-900 font-semibold">{Math.round((maior / menor - 1) * 100)}%</strong>{' '}
                superior ao menor.
              </p>
              <div className="mt-3"><Barra valor={Math.min(1, (maior / menor - 1))} cor="bg-caution-600" /></div>
              <p className="mt-3 text-xs text-ink-500">
                É essa dispersão que a equalização automática captura item a item.
              </p>
            </Painel>
          )}
        </aside>
      </div>
    </>
  )
}
