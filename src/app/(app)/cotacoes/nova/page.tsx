import Link from 'next/link'
import { exigir } from '@/lib/acesso'
import { todos } from '@/lib/db'
import { lerRecado } from '@/lib/flash'
import { CabecalhoPagina, Painel, Aviso } from '@/components/ui'
import { IconeMais, IconeInfo, IconeAlerta, IconeAjuste } from '@/components/icones'

export const dynamic = 'force-dynamic'

export default async function PaginaNovaCotacao(
  { searchParams }: { searchParams: { [k: string]: string | undefined } }
) {
  const s = await exigir('cotacoes')
  const eid = s.empresa?.id ?? null
  const recado = lerRecado(searchParams.f)
  const erro = recado?.erros._
  const escolhida = Number(searchParams.demanda) || 0

  // Só demandas abertas e com itens: cotação sem item não tem o que perguntar.
  const demandas = eid
    ? await todos<{ id: number; numero: string; centro_custo: string; itens: number }>(
        `select d.id, d.numero, d.centro_custo,
                (select count(*) from demanda_itens di where di.demanda_id = d.id) itens
           from demandas d
          where d.empresa_id = ? and d.status = 'aberta'
            and exists (select 1 from demanda_itens di where di.demanda_id = d.id)
          order by d.criado_em desc limit 200`, [eid])
    : []

  const daUrl = demandas.find((d) => d.id === escolhida) ?? null

  return (
    <>
      <CabecalhoPagina
        icone={<IconeMais size={19} />}
        migalhas={[{ rotulo: 'Cotações', href: '/cotacoes' }, { rotulo: 'Nova' }]}
        titulo="Nova cotação"
        descricao="A rodada nasce como rascunho: itens e convidados podem ser ajustados até o disparo. Depois disso a lista fica congelada." />

      {erro && (
        <div className="mb-4">
          <Aviso tom="critico" icone={<IconeAlerta size={16} />} titulo="Não foi possível abrir">{erro}</Aviso>
        </div>
      )}

      {!eid && (
        <div className="mb-4">
          <Aviso tom="critico" icone={<IconeAlerta size={16} />}>
            Nenhuma empresa selecionada. A cotação pertence a uma empresa — escolha uma no seletor
            do topo antes de continuar.
          </Aviso>
        </div>
      )}

      <form method="post" action="/api/fluxo" className="space-y-4">
        <input type="hidden" name="_op" value="cotacao.criar" />
        <input type="hidden" name="_voltar" value={`/cotacoes/nova${escolhida ? `?demanda=${escolhida}` : ''}`} />

        <Painel>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-x-4 gap-y-5">
            <div className="col-span-1 sm:col-span-6">
              <label className="rotulo" htmlFor="titulo">
                Título<span className="text-critical-600 ml-1" aria-hidden>*</span>
              </label>
              <input id="titulo" name="titulo" className="campo" maxLength={120} autoComplete="off"
                     defaultValue={daUrl ? `Cotação da requisição ${daUrl.numero}` : ''}
                     placeholder="Ex.: Rolamentos e retentores — reposição do 2º semestre" />
              <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
                É o assunto que o fornecedor vê no convite. Um título específico traz resposta mais rápida.
              </p>
            </div>

            <div className="col-span-1 sm:col-span-3">
              <label className="rotulo" htmlFor="demanda_id">Demanda de origem</label>
              <select id="demanda_id" name="demanda_id" className="campo" defaultValue={escolhida || ''}>
                <option value="">— nenhuma, montar itens do zero —</option>
                {demandas.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.numero} · {d.centro_custo} ({d.itens} {d.itens === 1 ? 'item' : 'itens'})
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
                Escolher uma requisição copia os itens dela e move a demanda para “em cotação”.
              </p>
            </div>

            <div className="col-span-1 sm:col-span-3">
              <label className="rotulo" htmlFor="canal">Canal do convite</label>
              <select id="canal" name="canal" className="campo" defaultValue="ambos">
                <option value="ambos">E-mail e portal</option>
                <option value="email">Somente e-mail</option>
                <option value="portal">Somente portal</option>
              </select>
              <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
                Por onde o fornecedor recebe e responde.
              </p>
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="rotulo" htmlFor="janela_horas">Janela de resposta (horas)</label>
              <input id="janela_horas" name="janela_horas" className="campo" inputMode="numeric"
                     autoComplete="off" defaultValue="48" />
              <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
                Conta a partir do disparo, e não de agora.
              </p>
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="rotulo" htmlFor="taxa_capital_mes">Taxa de capital (% a.m.)</label>
              <input id="taxa_capital_mes" name="taxa_capital_mes" className="campo" inputMode="decimal"
                     autoComplete="off" defaultValue="1,50" />
              <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
                Traz prazo de pagamento a valor presente.
              </p>
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="rotulo" htmlFor="peso_prazo_dia">Peso do prazo de entrega (% ao dia)</label>
              <input id="peso_prazo_dia" name="peso_prazo_dia" className="campo" inputMode="decimal"
                     autoComplete="off" defaultValue="0,000" />
              <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
                Zero ignora o prazo na comparação.
              </p>
            </div>
          </div>
        </Painel>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href="/cotacoes" className="btn btn-secundario">Cancelar</Link>
          <button type="submit" className="btn btn-primario" disabled={!eid}>Criar rascunho</button>
        </div>
      </form>

      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        <Aviso icone={<IconeAjuste size={16} />} titulo="Por que os parâmetros ficam na cotação">
          Taxa de capital e peso do prazo são gravados junto com a rodada, não lidos de uma
          configuração global. Uma cotação de dois anos atrás continua reproduzindo o mesmo
          resultado com os critérios que valiam à época.
        </Aviso>
        <Aviso icone={<IconeInfo size={16} />} titulo="Ordem dos passos">
          Criar o rascunho → incluir os itens → convidar fornecedores → disparar. Nada sai para
          fora antes do disparo, e o disparo pede confirmação.
        </Aviso>
      </div>
    </>
  )
}
