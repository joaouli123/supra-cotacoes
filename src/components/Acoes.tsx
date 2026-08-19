// =====================================================================
// Acoes de registro: criar, editar, inativar, reativar, homologar, excluir.
//
// Cada acao e um formulario proprio apontando para a rota de gravacao —
// nao um link. Verbo GET nao muda estado: se inativar fosse um link, o
// pre-carregador do navegador ou um rastreador de link inativaria o
// cadastro sozinho.
//
// A confirmacao das acoes destrutivas usa <details>, que abre e fecha sem
// JavaScript. Nada aqui depende de script.
// =====================================================================
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Especificacao } from '@/lib/registros'
import { Aviso } from './ui'
import {
  IconeMais, IconeLapis, IconeLixeira, IconeArquivar, IconeDesfazer,
  IconeSelo, IconeCheck, IconeAlerta,
} from './icones'

const ROTA = (spec: Especificacao) => `/api/registros/${spec.chave}`

/* --------------------------------------------------------------- criar -- */
export function BotaoNovo({ spec, rotulo }: { spec: Especificacao; rotulo?: string }) {
  return (
    <Link href={`${spec.base}/novo`} className="btn btn-primario btn-sm">
      <IconeMais size={15} />
      {rotulo ?? `Novo ${spec.rotulo.toLowerCase()}`}
    </Link>
  )
}

/* -------------------------------------------------------- campos ocultos */
function Ocultos({ id, op, voltar }: { id: number; op: string; voltar: string }) {
  return (
    <>
      <input type="hidden" name="_op" value={op} />
      <input type="hidden" name="_id" value={id} />
      <input type="hidden" name="_voltar" value={voltar} />
    </>
  )
}

/* ------------------------------------------------------------ alternar -- */
function Alternar({ spec, id, coluna, ligar, voltar, titulo, children, classe }: {
  spec: Especificacao; id: number; coluna: 'ativo' | 'homologado'; ligar: boolean
  voltar: string; titulo: string; children: ReactNode; classe?: string
}) {
  return (
    <form method="post" action={ROTA(spec)} className="inline">
      <Ocultos id={id} op="alternar" voltar={voltar} />
      <input type="hidden" name="_coluna" value={coluna} />
      <input type="hidden" name="_valor" value={ligar ? '1' : '0'} />
      <button type="submit" title={titulo} aria-label={titulo}
              className={classe ?? 'btn btn-sutil btn-sm btn-icone'}>
        {children}
      </button>
    </form>
  )
}

/* ------------------------------------------------------------- excluir -- */
function Excluir({ spec, id, voltar, rotulo }: {
  spec: Especificacao; id: number; voltar: string; rotulo: string
}) {
  return (
    <details className="relative inline-block">
      <summary className="btn btn-sutil btn-sm btn-icone text-ink-500 hover:text-critical-700 cursor-pointer"
               title="Excluir">
        <IconeLixeira size={15} />
      </summary>
      <div className="absolute right-0 top-full mt-1 z-20 w-64 p-3 rounded-lg border border-ink-200
                      bg-white shadow-lg text-left">
        <p className="text-xs text-ink-600 leading-relaxed mb-2.5">
          Excluir <strong className="font-medium text-ink-900">{rotulo}</strong> de vez?
          O histórico de envios permanece, sem o vínculo.
        </p>
        <form method="post" action={ROTA(spec)}>
          <Ocultos id={id} op="excluir" voltar={voltar} />
          <button type="submit" className="btn btn-sm w-full bg-critical-600 text-white
                                           border-critical-600 hover:bg-critical-700">
            Excluir definitivamente
          </button>
        </form>
      </div>
    </details>
  )
}

/* --------------------------------------------------- acoes de uma linha -- */
export function AcoesLinha({ spec, id, ativo, homologado, rotulo, voltar }: {
  spec: Especificacao; id: number; ativo?: number | boolean
  homologado?: number | boolean; rotulo: string; voltar: string
}) {
  const estaAtivo = ativo === undefined ? true : !!Number(ativo)
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Link href={`${spec.base}/${id}/editar?voltar=${encodeURIComponent(voltar)}`}
            className="btn btn-sutil btn-sm btn-icone" title="Editar" aria-label="Editar">
        <IconeLapis size={15} />
      </Link>

      {homologado !== undefined && (
        <Alternar spec={spec} id={id} coluna="homologado" ligar={!Number(homologado)} voltar={voltar}
                  titulo={Number(homologado) ? 'Suspender homologação' : 'Homologar'}>
          <IconeSelo size={15} className={Number(homologado) ? 'text-positive-700' : 'text-ink-400'} />
        </Alternar>
      )}

      {spec.temAtivo && (
        <Alternar spec={spec} id={id} coluna="ativo" ligar={!estaAtivo} voltar={voltar}
                  titulo={estaAtivo ? 'Inativar' : 'Reativar'}>
          {estaAtivo ? <IconeArquivar size={15} /> : <IconeDesfazer size={15} className="text-positive-700" />}
        </Alternar>
      )}

      {spec.exclusaoFisica && <Excluir spec={spec} id={id} voltar={voltar} rotulo={rotulo} />}
    </div>
  )
}

/* ------------------------------------------- acoes na tela de detalhe --- */
export function AcoesDetalhe({ spec, id, ativo, homologado, voltar }: {
  spec: Especificacao; id: number; ativo?: number | boolean
  homologado?: number | boolean; voltar: string
}) {
  const estaAtivo = ativo === undefined ? true : !!Number(ativo)
  const botao = 'btn btn-secundario btn-sm'
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {homologado !== undefined && (
        <Alternar spec={spec} id={id} coluna="homologado" ligar={!Number(homologado)} voltar={voltar}
                  classe={botao} titulo={Number(homologado) ? 'Suspender homologação' : 'Homologar'}>
          <IconeSelo size={15} />
          {Number(homologado) ? 'Suspender homologação' : 'Homologar'}
        </Alternar>
      )}
      {spec.temAtivo && (
        <Alternar spec={spec} id={id} coluna="ativo" ligar={!estaAtivo} voltar={voltar}
                  classe={botao} titulo={estaAtivo ? 'Inativar' : 'Reativar'}>
          {estaAtivo ? <IconeArquivar size={15} /> : <IconeDesfazer size={15} />}
          {estaAtivo ? 'Inativar' : 'Reativar'}
        </Alternar>
      )}
      <Link href={`${spec.base}/${id}/editar`} className="btn btn-primario btn-sm">
        <IconeLapis size={15} /> Editar
      </Link>
    </div>
  )
}

/* ----------------------------------------------------- retorno da acao -- */
const MENSAGENS: Record<string, string> = {
  criado: 'Cadastro criado.',
  salvo: 'Alterações salvas.',
  inativado: 'Registro inativado. Ele continua na base e na auditoria.',
  reativado: 'Registro reativado.',
  homologado: 'Fornecedor homologado — já pode ser convidado para cotações.',
  suspenso: 'Homologação suspensa.',
  excluido: 'Registro excluído.',
  aberta: 'Demanda aberta.',
  gerada: 'Cotação gerada a partir da demanda.',
  disparada: 'Convites disparados aos fornecedores.',
  encerrada: 'Cotação encerrada para novas propostas.',
  equalizada: 'Equalização concluída.',
  cancelada: 'Cotação cancelada.',
  item: 'Item adicionado.',
  removido: 'Item removido.',
  convidado: 'Fornecedor convidado.',
  convidados: 'Fornecedores aptos convidados.',
  convidados_teto: 'Convidamos os 40 fornecedores mais bem avaliados dos grupos destes itens. Havia mais aptos — inclua os demais um a um, se precisar.',
  desconvidado: 'Convite retirado.',
  atendida: 'Demanda marcada como atendida.',
  reaberta: 'Registro reaberto.',
}

/** Faixa de confirmacao apos uma acao, lida do `?ok=` da URL. */
export function Retorno({ ok }: { ok?: string }) {
  if (!ok) return null
  const msg = MENSAGENS[ok]
  if (!msg) return null
  return (
    <div className="mb-4">
      <Aviso tom="positivo" icone={<IconeCheck size={16} />}>{msg}</Aviso>
    </div>
  )
}

/** Faixa de erro vinda de uma acao recusada (`?f=` com recado gravado). */
export function Recusa({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null
  return (
    <div className="mb-4">
      <Aviso tom="critico" icone={<IconeAlerta size={16} />}>{mensagem}</Aviso>
    </div>
  )
}
