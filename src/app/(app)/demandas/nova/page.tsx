import Link from 'next/link'
import { exigir } from '@/lib/acesso'
import { lerRecado } from '@/lib/flash'
import { CabecalhoPagina, Painel, Aviso } from '@/components/ui'
import { IconeMais, IconeInfo, IconeAlerta } from '@/components/icones'

export const dynamic = 'force-dynamic'

const ORIGENS = [
  { valor: 'requisicao', rotulo: 'Requisição interna', ajuda: 'pedido de uma área da empresa' },
  { valor: 'estoque_minimo', rotulo: 'Estoque mínimo', ajuda: 'ponto de reposição atingido' },
  { valor: 'manual', rotulo: 'Lançamento manual', ajuda: 'aberta aqui pelo comprador' },
  { valor: 'erp', rotulo: 'Integração ERP', ajuda: 'veio do sistema de gestão' },
]

export default async function PaginaNovaDemanda(
  { searchParams }: { searchParams: { [k: string]: string | undefined } }
) {
  const s = await exigir('demandas')
  const recado = lerRecado(searchParams.f)
  const erro = recado?.erros._
  const empresa = s.empresa?.nome_fantasia ?? null

  return (
    <>
      <CabecalhoPagina
        icone={<IconeMais size={19} />}
        migalhas={[{ rotulo: 'Demandas', href: '/demandas' }, { rotulo: 'Nova' }]}
        titulo="Nova demanda de compra"
        descricao="Primeiro o cabeçalho da requisição. Os itens entram na tela seguinte, um a um — assim cada inclusão já fica gravada." />

      {erro && (
        <div className="mb-4">
          <Aviso tom="critico" icone={<IconeAlerta size={16} />} titulo="Não foi possível abrir">{erro}</Aviso>
        </div>
      )}

      {!empresa && (
        <div className="mb-4">
          <Aviso tom="critico" icone={<IconeAlerta size={16} />}>
            Nenhuma empresa selecionada. A demanda pertence a uma empresa — escolha uma no seletor
            do topo antes de continuar.
          </Aviso>
        </div>
      )}

      <form method="post" action="/api/fluxo" className="space-y-4">
        <input type="hidden" name="_op" value="demanda.criar" />
        <input type="hidden" name="_voltar" value="/demandas/nova" />

        <Painel>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-x-4 gap-y-5">
            <div className="col-span-1 sm:col-span-3">
              <label className="rotulo" htmlFor="origem">
                Origem<span className="text-critical-600 ml-1" aria-hidden>*</span>
              </label>
              <select id="origem" name="origem" className="campo" defaultValue="manual">
                {ORIGENS.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
              </select>
              <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
                De onde nasceu o pedido. A origem acompanha a requisição até a auditoria.
              </p>
            </div>

            <div className="col-span-1 sm:col-span-3">
              <label className="rotulo" htmlFor="centro_custo">
                Centro de custo<span className="text-critical-600 ml-1" aria-hidden>*</span>
              </label>
              <input id="centro_custo" name="centro_custo" className="campo" maxLength={80}
                     autoComplete="off" placeholder="Ex.: Manutenção industrial" />
              <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
                Onde a despesa será apropriada.
              </p>
            </div>

            <div className="col-span-1 sm:col-span-6">
              <label className="rotulo" htmlFor="solicitante">Solicitante</label>
              <input id="solicitante" name="solicitante" className="campo" maxLength={90}
                     autoComplete="off" defaultValue={s.usuario.nome} />
              <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
                Quem pediu. Em branco, entra o seu nome.
              </p>
            </div>
          </div>
        </Painel>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href="/demandas" className="btn btn-secundario">Cancelar</Link>
          <button type="submit" className="btn btn-primario" disabled={!empresa}>Abrir demanda</button>
        </div>
      </form>

      <div className="mt-4">
        <Aviso icone={<IconeInfo size={16} />}>
          O número da requisição (<span className="texto-mono text-xs">REQ-{new Date().getFullYear()}-00000</span>)
          é gerado na gravação e não se repete — é por ele que a demanda é rastreada até a cotação
          e a trilha de auditoria.
        </Aviso>
      </div>
    </>
  )
}
