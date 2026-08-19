// =====================================================================
// Controles do ciclo de vida — demandas e cotacoes.
//
// Cada botao aqui e um <form method="post"> proprio, e nao um link: GET
// nao muda estado, e um disparo de cotacao acionado pelo pre-carregador do
// navegador mandaria e-mail a fornecedor de verdade.
//
// A confirmacao dos passos sem volta usa <details>, que abre e fecha sem
// JavaScript. Nada nesta tela depende de script.
// =====================================================================
import type { ReactNode } from 'react'
import { IconeAlerta } from './icones'

const ROTA = '/api/fluxo'

/* ------------------------------------------------------------- direto ---- */

/** Botao que executa a operacao no clique, sem confirmar. */
export function AcaoFluxo({ op, id, voltar, extras, classe, titulo, rota, children }: {
  op: string; id?: number; voltar: string
  extras?: Record<string, string | number>
  /** Destino do POST. As acoes de e-mail vivem em `/api/email`. */
  rota?: string
  classe?: string; titulo?: string; children: ReactNode
}) {
  return (
    <form method="post" action={rota ?? ROTA} className="inline">
      <input type="hidden" name="_op" value={op} />
      {id !== undefined && <input type="hidden" name="_id" value={id} />}
      <input type="hidden" name="_voltar" value={voltar} />
      {Object.entries(extras ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={String(v)} />
      ))}
      <button type="submit" title={titulo} className={classe ?? 'btn btn-secundario btn-sm'}>
        {children}
      </button>
    </form>
  )
}

/* -------------------------------------------------------- com confirmacao */

/**
 * Botao que abre um cartao de confirmacao antes de executar.
 * Para o que nao tem desfazer: disparar convites, encerrar a rodada,
 * cancelar uma requisicao.
 */
export function AcaoConfirmada({ op, id, voltar, extras, rotulo, icone, aviso, confirmar, tom = 'normal', largura = 'w-72', rota }: {
  op: string; id?: number; voltar: string
  extras?: Record<string, string | number>
  rotulo: string; icone?: ReactNode; aviso: ReactNode; confirmar: string
  tom?: 'normal' | 'primario' | 'critico'; largura?: string
  /** Destino do POST. As acoes de e-mail vivem em `/api/email`. */
  rota?: string
}) {
  const gatilho =
    tom === 'primario' ? 'btn btn-primario btn-sm cursor-pointer'
    : tom === 'critico' ? 'btn btn-secundario btn-sm cursor-pointer text-critical-700 hover:border-critical-400'
    : 'btn btn-secundario btn-sm cursor-pointer'
  const acao =
    tom === 'critico'
      ? 'btn btn-sm w-full bg-critical-600 text-white border-critical-600 hover:bg-critical-700'
      : 'btn btn-primario btn-sm w-full'

  return (
    <details className="relative inline-block">
      <summary className={gatilho}>{icone}{rotulo}</summary>
      <div className={`absolute right-0 top-full mt-1 z-20 ${largura} p-3 rounded-lg border border-ink-200
                       bg-white shadow-lg text-left`}>
        <p className="text-xs text-ink-600 leading-relaxed mb-2.5">{aviso}</p>
        <form method="post" action={rota ?? ROTA}>
          <input type="hidden" name="_op" value={op} />
          {id !== undefined && <input type="hidden" name="_id" value={id} />}
          <input type="hidden" name="_voltar" value={voltar} />
          {Object.entries(extras ?? {}).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={String(v)} />
          ))}
          <button type="submit" className={acao}>{confirmar}</button>
        </form>
      </div>
    </details>
  )
}

/* ------------------------------------------------------- incluir um item - */

export type OpcaoMaterial = { valor: number; rotulo: string }

/**
 * Linha de inclusao de item: escolher o material e a quantidade.
 *
 * Um item por vez, gravado no servidor a cada inclusao. A alternativa —
 * montar a lista inteira no navegador e enviar de uma vez — exigiria
 * JavaScript e perderia tudo se a aba fechasse no meio.
 */
export function IncluirItem({ op, id, voltar, materiais, unidade }: {
  op: string; id: number; voltar: string
  materiais: OpcaoMaterial[]
  /** Rotulo de apoio: a unidade vem do cadastro do material. */
  unidade?: string
}) {
  if (materiais.length === 0) {
    return (
      <p className="text-xs text-ink-500 px-4 sm:px-5 py-3 flex items-center gap-2">
        <IconeAlerta size={14} className="text-caution-600" />
        Nenhum material ativo disponível para esta empresa.
      </p>
    )
  }
  return (
    <form method="post" action={ROTA}
          className="px-4 sm:px-5 py-3 border-t border-ink-100 bg-ink-50/60
                     flex flex-wrap items-end gap-2">
      <input type="hidden" name="_op" value={op} />
      <input type="hidden" name="_id" value={id} />
      <input type="hidden" name="_voltar" value={voltar} />

      <div className="flex-1 min-w-[240px]">
        <label className="rotulo" htmlFor={`mat_${id}`}>Material</label>
        <select id={`mat_${id}`} name="material_id" className="campo" defaultValue="">
          <option value="">— selecione —</option>
          {materiais.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
        </select>
      </div>

      <div className="w-32">
        <label className="rotulo" htmlFor={`qtd_${id}`}>Quantidade</label>
        <input id={`qtd_${id}`} name="quantidade" className="campo" inputMode="decimal"
               placeholder="0,00" autoComplete="off" />
      </div>

      <button type="submit" className="btn btn-secundario">Incluir item</button>
      {unidade && <span className="text-2xs text-ink-500 pb-2.5">{unidade}</span>}
    </form>
  )
}

/* ----------------------------------------------------- remover um item --- */

export function RemoverItem({ op, id, itemId, voltar, campo = 'item_id', titulo = 'Remover item' }: {
  op: string; id: number; itemId: number; voltar: string
  /** Nome do campo esperado pela operacao — o convite nao e um item. */
  campo?: string
  titulo?: string
}) {
  return (
    <AcaoFluxo op={op} id={id} voltar={voltar} extras={{ [campo]: itemId }}
               classe="btn btn-sutil btn-sm btn-icone text-ink-400 hover:text-critical-700"
               titulo={titulo}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.7" strokeLinecap="round" aria-hidden>
        <path d="M5 12h14" />
      </svg>
    </AcaoFluxo>
  )
}

/* --------------------------------------------------- convidar fornecedor - */

export type OpcaoFornecedor = { valor: number; rotulo: string }

/**
 * Convite avulso. O botao ao lado convida de uma vez todos os homologados
 * habilitados nos grupos dos itens — o mesmo criterio do disparo programado.
 */
export function ConvidarFornecedor({ id, voltar, fornecedores }: {
  id: number; voltar: string; fornecedores: OpcaoFornecedor[]
}) {
  return (
    <div className="px-4 sm:px-5 py-3 border-t border-ink-100 bg-ink-50/60
                    flex flex-wrap items-end gap-2">
      <form method="post" action={ROTA} className="flex-1 min-w-[240px] flex items-end gap-2">
        <input type="hidden" name="_op" value="cotacao.convidar" />
        <input type="hidden" name="_id" value={id} />
        <input type="hidden" name="_voltar" value={voltar} />
        <div className="flex-1 min-w-0">
          <label className="rotulo" htmlFor={`forn_${id}`}>Convidar fornecedor</label>
          <select id={`forn_${id}`} name="fornecedor_id" className="campo" defaultValue="">
            <option value="">— selecione —</option>
            {fornecedores.map((f) => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-secundario" disabled={fornecedores.length === 0}>
          Convidar
        </button>
      </form>

      <AcaoFluxo op="cotacao.aptos" id={id} voltar={voltar} classe="btn btn-secundario"
                 titulo="Convida todos os homologados habilitados nos grupos dos itens">
        Convidar todos os aptos
      </AcaoFluxo>
    </div>
  )
}
