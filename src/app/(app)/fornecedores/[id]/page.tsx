import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigir, exigirEmpresa } from '@/lib/acesso'
import { um, todos } from '@/lib/db'
import { moeda, numero, data, dataHora, dec } from '@/lib/formato'
import { Painel, CabecalhoPagina, Campo, Vazio, Tag, StatusTag } from '@/components/ui'
import { IconeFabrica, IconeEtiqueta, IconeBalanca, IconeEscudo, IconeDocumento, IconeLocal, IconeEmail, IconeTelefone, IconeUsuario } from '@/components/icones'

export const dynamic = 'force-dynamic'

export default async function PaginaFornecedor({ params }: { params: { id: string } }) {
  const s = await exigir('cadastros')
  const id = Number(params.id)
  const f = await um<{
    id: number; razao_social: string; nome_fantasia: string; cnpj: string; email: string
    telefone: string; contato: string; cidade: string; uf: string; cond_pagamento: string
    prazo_entrega_dias: number; avaliacao: number; homologado: number; ativo: number
    criado_em: string; atualizado_em: string; empresa_id: number | null; empresa: string | null
  }>(`select f.*, e.nome_fantasia as empresa from fornecedores f
        left join empresas e on e.id = f.empresa_id where f.id = ?`, [id])
  if (!f) notFound()
  exigirEmpresa(s, f.empresa_id, true)

  const grupos = await todos<{ nome: string; nivel: number; caminho: string }>(
    `select c.nome, c.nivel, c.caminho from fornecedor_grupos fg
       join classificacoes c on c.id = fg.classificacao_id
      where fg.fornecedor_id = ? order by c.nivel, c.nome`, [id])

  const participacoes = await todos<{
    cotacao_id: number; numero: string; titulo: string; status: string; cf_status: string
    convidado_em: string; respondido_em: string | null; total: number | null
  }>(
    `select c.id as cotacao_id, c.numero, c.titulo, c.status, cf.status as cf_status,
            cf.convidado_em, cf.respondido_em,
            (select sum(pi.preco_unitario * ci.quantidade)
               from proposta_itens pi
               join propostas p2 on p2.id = pi.proposta_id
               join cotacao_itens ci on ci.id = pi.cotacao_item_id
              where p2.cotacao_id = c.id and p2.fornecedor_id = ?) total
       from cotacao_fornecedores cf
       join cotacoes c on c.id = cf.cotacao_id
      where cf.fornecedor_id = ? order by cf.convidado_em desc limit 15`, [id, id])

  const auditoria = await todos<{
    campo: string; valor_anterior: string | null; valor_novo: string | null
    operacao: string; usuario_nome: string; ip: string; criado_em: string
  }>(
    `select campo, valor_anterior, valor_novo, operacao, usuario_nome, ip, criado_em
       from auditoria where entidade = 'fornecedores' and entidade_id = ?
      order by criado_em desc limit 20`, [id])

  const respondidas = participacoes.filter((p) => p.cf_status === 'respondido').length
  const taxa = participacoes.length ? respondidas / participacoes.length : 0

  return (
    <>
      <CabecalhoPagina
        migalhas={[{ rotulo: 'Fornecedores', href: '/fornecedores' }, { rotulo: f.cnpj }]}
        icone={<IconeFabrica size={19} />}
        titulo={f.razao_social}
        descricao={`${f.nome_fantasia} · ${f.cidade}/${f.uf}`}
        acoes={<Tag variante={f.homologado ? 'positiva' : 'atencao'} ponto>{f.homologado ? 'Homologado' : 'Homologação pendente'}</Tag>}
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-5">
        <div className="space-y-4 sm:space-y-5 min-w-0">
          <Painel icone={<IconeEtiqueta size={15} />} titulo="Grupos habilitados para fornecimento">
            {grupos.length === 0 ? <Vazio icone={<IconeEtiqueta size={20} />} titulo="Nenhum grupo vinculado" descricao="Sem grupos, o fornecedor não é convidado automaticamente." /> : (
              <div className="flex flex-wrap gap-1.5">
                {grupos.map((g, i) => (
                  <span key={i} className="tag tag-neutra" title={g.caminho}>
                    <span className="text-ink-400 text-2xs">N{g.nivel}</span>{g.nome}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-3 pt-3 border-t border-ink-100 text-xs text-ink-500">
              Cotações que contenham itens desses grupos convidam este fornecedor automaticamente.
            </p>
          </Painel>

          <Painel semPadding icone={<IconeBalanca size={15} />} titulo="Participação em cotações"
            acao={participacoes.length > 0 && (
              <span className="text-xs text-ink-500">
                Taxa de resposta <strong className="text-ink-700 font-medium tabular">{(taxa * 100).toFixed(0)}%</strong>
              </span>
            )}>
            {participacoes.length === 0 ? <Vazio icone={<IconeBalanca size={20} />} titulo="Nunca foi convidado" descricao="Convites dependem dos grupos de materiais habilitados." /> : (
              <div className="rolagem-x">
                <table className="tabela tabela-cartoes">
                  <thead><tr><th>Cotação</th><th>Convidado</th><th>Respondido</th><th className="num">Valor proposto</th><th>Situação</th></tr></thead>
                  <tbody>
                    {participacoes.map((p, i) => (
                      <tr key={i}>
                        <td data-p>
                          <Link href={`/cotacoes/${p.cotacao_id}`} className="block group">
                            <span className="block text-sm text-ink-900 group-hover:text-petrol-700 font-medium md:font-normal
                                             md:truncate md:max-w-[220px] transition-colors">{p.titulo}</span>
                            <span className="texto-mono text-2xs text-ink-500">{p.numero}</span>
                          </Link>
                        </td>
                        <td data-r="Convidado" className="text-xs text-ink-500 whitespace-nowrap">{data(p.convidado_em)}</td>
                        <td data-r="Respondido" className="text-xs text-ink-500 whitespace-nowrap">{p.respondido_em ? data(p.respondido_em) : '—'}</td>
                        <td data-r="Valor proposto" className="num text-sm whitespace-nowrap font-medium">{p.total ? moeda(p.total) : '—'}</td>
                        <td data-r="Situação"><StatusTag status={p.cf_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>

          {/* ------------------------------------------- trilha de auditoria */}
          <Painel semPadding icone={<IconeEscudo size={15} />} titulo="Trilha de auditoria"
            acao={<Link href="/auditoria" className="text-xs text-ink-500 hover:text-ink-900">Auditoria completa</Link>}>
            {auditoria.length === 0 ? <Vazio icone={<IconeEscudo size={20} />} titulo="Sem alterações registradas" descricao="Toda mudança de campo passa a constar aqui." /> : (
              <ul className="divide-y divide-ink-100">
                {auditoria.map((a, i) => (
                  <li key={i} className="px-4 sm:px-5 py-3 flex items-start gap-3 sm:gap-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-ink-300 mt-2 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-900">
                        <span className="font-medium">{a.usuario_nome}</span>{' '}
                        <span className="text-ink-500">
                          {a.operacao === 'inclusao' ? 'incluiu o cadastro'
                            : a.operacao === 'inativacao' ? 'inativou o cadastro'
                            : <>alterou <span className="texto-mono text-xs bg-ink-100 px-1 rounded">{a.campo}</span></>}
                        </span>
                      </p>
                      {a.operacao === 'alteracao' && (
                        <p className="text-xs text-ink-500 mt-0.5">
                          <span className="line-through">{a.valor_anterior ?? '—'}</span>
                          <span className="mx-1.5 text-ink-300">→</span>
                          <span className="text-ink-700">{a.valor_novo ?? '—'}</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-ink-500 whitespace-nowrap">{dataHora(a.criado_em)}</p>
                      <p className="text-2xs texto-mono text-ink-400">{a.ip}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </div>

        <aside className="space-y-4 sm:space-y-5">
          <Painel icone={<IconeDocumento size={15} />} titulo="Dados cadastrais">
            <dl>
              <Campo rotulo="CNPJ"><span className="texto-mono text-xs">{f.cnpj}</span></Campo>
              <Campo rotulo="Contato" icone={<IconeUsuario size={12} />}>{f.contato}</Campo>
              <Campo rotulo="E-mail" icone={<IconeEmail size={12} />}><span className="text-xs">{f.email}</span></Campo>
              <Campo rotulo="Telefone" icone={<IconeTelefone size={12} />}>{f.telefone}</Campo>
              <Campo rotulo="Praça" icone={<IconeLocal size={12} />}>{f.cidade}/{f.uf}</Campo>
              <Campo rotulo="Condição padrão">{f.cond_pagamento}</Campo>
              <Campo rotulo="Prazo de entrega">{f.prazo_entrega_dias} dias</Campo>
              <Campo rotulo="Avaliação"><strong className="tabular font-semibold">{dec(f.avaliacao, 1)}</strong> / 5,0</Campo>
              <Campo rotulo="Vínculo">{f.empresa ?? 'Base corporativa'}</Campo>
              <Campo rotulo="Cadastrado em">{data(f.criado_em)}</Campo>
            </dl>
          </Painel>
        </aside>
      </div>
    </>
  )
}
