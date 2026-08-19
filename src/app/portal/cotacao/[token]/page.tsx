import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { um, todos, executar } from '@/lib/db'
import { moeda, numero, data, dataHora } from '@/lib/formato'
import { Painel, Vazio, Campo, Tag, StatusTag, Aviso } from '@/components/ui'
import { sessao } from '@/lib/sessao'
import { IconeCheck, IconeAlerta, IconeSeta, IconeLista, IconeDocumento, IconeUsuario, IconeInfo, IconeCalendario } from '@/components/icones'
import { COND_PAGAMENTO } from '@/lib/opcoes'

export const dynamic = 'force-dynamic'

export default async function PortalCotacao({
  params, searchParams,
}: { params: { token: string }; searchParams: { [k: string]: string | undefined } }) {
  const convite = await um<{
    id: number; cotacao_id: number; fornecedor_id: number; status: string; convidado_em: string
    respondido_em: string | null; numero: string; titulo: string; encerra_em: string | null
    cot_status: string; empresa: string; comprador: string; canal: string
  }>(
    `select cf.id, cf.cotacao_id, cf.fornecedor_id, cf.status, cf.convidado_em, cf.respondido_em,
            c.numero, c.titulo, c.encerra_em, c.status as cot_status, c.canal,
            e.nome_fantasia as empresa, u.nome as comprador
       from cotacao_fornecedores cf
       join cotacoes c on c.id = cf.cotacao_id
       join empresas e on e.id = c.empresa_id
       join usuarios u on u.id = c.comprador_id
      where cf.token = ?`, [params.token])
  if (!convite) notFound()

  // O token manda: se a sessao aponta para outro fornecedor, reentra pela porta
  // do portal para alinhar identificacao e dados.
  const atual = await sessao({ publico: true })
  if (atual.fornecedor?.id !== convite.fornecedor_id) {
    redirect(`/api/portal?token=${params.token}`)
  }

  // Registra a visualizacao — exatamente como aconteceria no acesso real.
  if (convite.status === 'convidado') {
    await executar(`update cotacao_fornecedores set status='visualizado', visualizado_em=? where id=?`,
      [new Date().toISOString(), convite.id])
    convite.status = 'visualizado'
  }

  const fornecedor = (await um<{
    razao_social: string; cnpj: string; contato: string
    cond_pagamento: string; prazo_entrega_dias: number
  }>('select razao_social, cnpj, contato, cond_pagamento, prazo_entrega_dias from fornecedores where id = ?',
     [convite.fornecedor_id]))!

  const itens = await todos<{
    id: number; codigo: string; descricao: string; especificacao: string
    unidade: string; unidade_desc: string; quantidade: number; ordem: number
  }>(
    `select ci.id, m.codigo, m.descricao, m.especificacao, un.sigla as unidade,
            un.descricao as unidade_desc, ci.quantidade, ci.ordem
       from cotacao_itens ci
       join materiais m on m.id = ci.material_id
       join unidades un on un.id = ci.unidade_id
      where ci.cotacao_id = ? order by ci.ordem`, [convite.cotacao_id])

  const proposta = await um<{
    id: number; frete_tipo: string; valor_frete: number; prazo_entrega_dias: number
    cond_pagamento: string; prazo_pagamento_dias: number; desconto_pct: number
    validade_dias: number; observacoes: string | null; enviada_em: string
  }>('select * from propostas where cotacao_id = ? and fornecedor_id = ?',
     [convite.cotacao_id, convite.fornecedor_id])

  const itensProposta = proposta
    ? await todos<{ cotacao_item_id: number; preco_unitario: number; ipi_pct: number; icms_st_pct: number; marca: string | null; disponivel: number }>(
        'select cotacao_item_id, preco_unitario, ipi_pct, icms_st_pct, marca, disponivel from proposta_itens where proposta_id = ?',
        [proposta.id])
    : []
  const mapaProposta = new Map(itensProposta.map((i) => [i.cotacao_item_id, i]))
  const totalProposta = itensProposta.reduce((s, i) => {
    const it = itens.find((x) => x.id === i.cotacao_item_id)
    return s + (i.disponivel ? i.preco_unitario * (it?.quantidade ?? 0) : 0)
  }, 0)

  const encerrada = convite.cot_status !== 'em_andamento'
  const somenteLeitura = !!proposta || encerrada
  const enviada = searchParams.enviada === '1'

  return (
    <>
      {enviada && (
        <div className="mb-5 painel border-positive-600/40 bg-positive-100/40 px-5 py-3.5 flex items-center gap-3">
          <span className="text-positive-700"><IconeCheck size={18} /></span>
          <div>
            <p className="text-sm font-medium text-ink-900">Proposta enviada com sucesso.</p>
            <p className="text-xs text-ink-600">
              Ela já entrou na equalização automática do comprador — nenhuma digitação é necessária do outro lado.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-xs text-ink-500 mb-1.5">
            <Link href="/portal" className="hover:text-ink-900">Portal</Link>
            <span className="text-ink-300">/</span>
            <span className="texto-mono">{convite.numero}</span>
          </nav>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900">{convite.titulo}</h1>
          <p className="text-sm text-ink-500 mt-1">
            Solicitado por <strong className="text-ink-700 font-medium">{convite.empresa}</strong> ·
            comprador {convite.comprador.split(' ').slice(0, 2).join(' ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusTag status={convite.status} />
          {convite.encerra_em && !encerrada && (
            <div className="text-right border-l border-ink-200 pl-3 ml-1">
              <p className="text-2xs uppercase tracking-wider text-ink-400">Prazo</p>
              <p className="text-sm tabular text-ink-900">{data(convite.encerra_em)}</p>
            </div>
          )}
        </div>
      </div>

      {encerrada && !proposta && (
        <div className="mb-5">
          <Aviso tom="atencao" icone={<IconeAlerta size={16} />}>
            Esta cotação já foi encerrada pelo comprador e não aceita mais propostas.
          </Aviso>
        </div>
      )}

      {somenteLeitura && proposta ? (
        /* ------------------------------------------- proposta ja enviada */
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 sm:gap-5">
          <Painel semPadding icone={<IconeCheck size={15} />} titulo="Proposta enviada"
            acao={<span className="text-xs text-ink-500">Total {moeda(totalProposta)}</span>}>
            <div className="rolagem-x">
              <table className="tabela tabela-cartoes">
                <thead><tr>
                  <th>Item</th><th className="num">Qtd.</th><th className="num">Preço unit.</th>
                  <th className="num">IPI</th><th>Marca</th><th className="num">Total</th>
                </tr></thead>
                <tbody>
                  {itens.map((it) => {
                    const pi = mapaProposta.get(it.id)
                    return (
                      <tr key={it.id}>
                        <td data-p>
                          <span className="text-sm text-ink-900 font-medium md:font-normal">{it.descricao}</span>
                          <span className="texto-mono text-2xs text-ink-500 block mt-0.5">{it.codigo}</span>
                        </td>
                        <td data-r="Quantidade" className="num text-sm whitespace-nowrap">{numero(it.quantidade)} {it.unidade}</td>
                        <td data-r="Preço unit." className="num text-sm">{pi?.disponivel ? moeda(pi.preco_unitario) : <Tag variante="neutra">não ofertado</Tag>}</td>
                        <td data-r="IPI" className="num text-xs text-ink-600">{pi?.disponivel ? `${pi.ipi_pct}%` : '—'}</td>
                        <td data-r="Marca" className="text-xs text-ink-600">{pi?.marca ?? '—'}</td>
                        <td data-r="Total" className="num text-sm font-medium">
                          {pi?.disponivel ? moeda(pi.preco_unitario * it.quantidade) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Painel>

          <aside className="space-y-4 sm:space-y-5">
            <Painel icone={<IconeDocumento size={15} />} titulo="Condições informadas">
              <dl>
                <Campo rotulo="Frete">{proposta.frete_tipo}{proposta.frete_tipo === 'FOB' && ` · ${moeda(proposta.valor_frete)}`}</Campo>
                <Campo rotulo="Prazo de entrega">{proposta.prazo_entrega_dias} dias</Campo>
                <Campo rotulo="Condição de pagamento">{proposta.cond_pagamento}</Campo>
                <Campo rotulo="Desconto comercial">{proposta.desconto_pct > 0 ? `${proposta.desconto_pct}%` : '—'}</Campo>
                <Campo rotulo="Validade">{proposta.validade_dias} dias</Campo>
                <Campo rotulo="Enviada em">{dataHora(proposta.enviada_em)}</Campo>
              </dl>
              {proposta.observacoes && (
                <p className="mt-3 pt-3 border-t border-ink-100 text-xs text-ink-600">{proposta.observacoes}</p>
              )}
            </Painel>
            <Painel icone={<IconeInfo size={15} />} titulo="O que acontece agora">
              <p className="text-sm text-ink-600">
                Sua proposta entrou automaticamente na equalização. O comparativo considera preço,
                frete, impostos, prazo de entrega e condição de pagamento — não apenas o preço unitário.
              </p>
            </Painel>
          </aside>
        </div>
      ) : (
        /* ------------------------------------------- formulario de proposta */
        <form action={`/portal/cotacao/${params.token}/enviar`} method="post">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 sm:gap-5 items-start">
            <Painel semPadding icone={<IconeLista size={15} />} titulo={`Itens solicitados (${itens.length})`}
              acao={<span className="text-xs text-ink-500">Informe o preço unitário de cada item</span>}>
              <div className="rolagem-x">
                <table className="tabela tabela-cartoes">
                  <thead><tr>
                    <th>Item</th><th className="num">Qtd.</th>
                    <th className="num min-w-[130px]">Preço unitário</th>
                    <th className="num min-w-[90px]">IPI %</th>
                    <th className="min-w-[130px]">Marca</th>
                    <th className="min-w-[90px]">Ofertar</th>
                  </tr></thead>
                  <tbody>
                    {itens.map((it) => (
                      <tr key={it.id}>
                        <td data-p>
                          <span className="text-sm text-ink-900 font-medium md:font-normal">{it.descricao}</span>
                          <span className="texto-mono text-2xs text-ink-500 block mt-0.5">{it.codigo}</span>
                          <span className="block text-2xs text-ink-400 md:max-w-[280px] md:truncate mt-0.5">{it.especificacao}</span>
                        </td>
                        <td data-r="Quantidade" className="num text-sm whitespace-nowrap">
                          {numero(it.quantidade)} <span className="text-2xs text-ink-400">{it.unidade}</span>
                        </td>
                        <td data-r="Preço unitário">
                          <input type="number" step="0.01" min="0" name={`preco_${it.id}`}
                                 aria-label={`Preço unitário de ${it.descricao}`}
                                 className="campo text-right md:w-[130px]" placeholder="0,00" />
                        </td>
                        <td data-r="IPI">
                          <select name={`ipi_${it.id}`} aria-label={`IPI de ${it.descricao}`}
                                  className="campo md:w-[90px]" defaultValue="0">
                            {[0, 5, 10, 15].map((v) => <option key={v} value={v}>{v}%</option>)}
                          </select>
                        </td>
                        <td data-r="Marca">
                          <input type="text" name={`marca_${it.id}`} aria-label={`Marca ofertada para ${it.descricao}`}
                                 className="campo md:w-[130px]" placeholder="Opcional" maxLength={40} />
                        </td>
                        <td data-r="Ofertar">
                          <label className="flex items-center gap-1.5 text-xs text-ink-600 cursor-pointer justify-end md:justify-start">
                            <input type="checkbox" name={`disp_${it.id}`} defaultChecked value="1"
                                   className="w-3.5 h-3.5 rounded border-ink-300 text-ink-900 focus:ring-0" />
                            sim
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Painel>

            <aside className="space-y-4 sm:space-y-5 lg:sticky lg:top-20">
              <Painel icone={<IconeDocumento size={15} />} titulo="Condições comerciais">
                <div className="space-y-3.5">
                  <div>
                    <label className="rotulo">Tipo de frete</label>
                    <select name="frete_tipo" className="campo cursor-pointer" defaultValue="CIF">
                      <option value="CIF">CIF — frete incluso no preço</option>
                      <option value="FOB">FOB — frete cobrado à parte</option>
                    </select>
                  </div>
                  <div>
                    <label className="rotulo">Valor do frete (se FOB)</label>
                    <input type="number" step="0.01" min="0" name="valor_frete" className="campo text-right" placeholder="0,00" />
                  </div>
                  <div>
                    <label className="rotulo">Prazo de entrega (dias)</label>
                    <input type="number" min="1" max="365" name="prazo_entrega" className="campo text-right"
                           defaultValue={fornecedor.prazo_entrega_dias} required />
                  </div>
                  <div>
                    <label className="rotulo">Condição de pagamento</label>
                    <select name="cond_pagamento" className="campo cursor-pointer" defaultValue={fornecedor.cond_pagamento}>
                      {COND_PAGAMENTO.map(([r]) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="rotulo">Desconto %</label>
                      <input type="number" step="0.01" min="0" max="90" name="desconto" className="campo text-right" placeholder="0" />
                    </div>
                    <div>
                      <label className="rotulo">Validade (dias)</label>
                      <input type="number" min="1" max="180" name="validade" className="campo text-right" defaultValue={30} required />
                    </div>
                  </div>
                  <div>
                    <label className="rotulo">Observações</label>
                    <textarea name="observacoes" rows={3} maxLength={240}
                              className="campo h-auto py-2 resize-none" placeholder="Opcional" />
                  </div>
                </div>
              </Painel>

              <Painel icone={<IconeUsuario size={15} />} titulo="Identificação">
                <dl>
                  <Campo rotulo="Fornecedor"><span className="text-xs">{fornecedor.razao_social}</span></Campo>
                  <Campo rotulo="CNPJ"><span className="texto-mono text-xs">{fornecedor.cnpj}</span></Campo>
                  <Campo rotulo="Responsável">{fornecedor.contato}</Campo>
                </dl>
              </Painel>

              <button type="submit" className="btn btn-primario w-full h-10">
                Enviar proposta<IconeSeta size={15} />
              </button>
              <p className="text-2xs text-ink-500 text-center">
                Itens sem preço informado são registrados como não ofertados.
              </p>
            </aside>
          </div>
        </form>
      )}
    </>
  )
}
