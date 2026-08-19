// =====================================================================
// Formulario derivado da especificacao da entidade.
//
// Um componente para os sete cadastros. O que muda entre eles esta em
// `src/lib/registros.ts`, e e a mesma descricao que o servidor usa para
// validar e gravar — entao um campo novo aparece na tela e passa a ser
// gravado no mesmo commit, sem chance de um lado esquecer o outro.
//
// HTML puro, sem JavaScript: `method="post"` para a rota de gravacao, que
// responde com redirecionamento. Funciona com o navegador que o cliente
// tiver, e nao quebra se um script falhar.
// =====================================================================
import Link from 'next/link'
import type { Especificacao, Campo } from '@/lib/registros'
import type { Erros, Valores, ListaOpcoes } from '@/lib/gravar'
import { DIAS_SEMANA } from '@/lib/listas'
import { Painel, Aviso } from './ui'
import { IconeAlerta } from './icones'

/**
 * Largura na grade de seis colunas.
 * Mapa literal, e nao classe montada em tempo de execucao: o Tailwind so
 * gera o que consegue ler no codigo-fonte.
 */
const LARGURA: Record<number, string> = {
  2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4', 6: 'sm:col-span-6',
}

const SIM_NAO = [{ valor: '1', rotulo: 'Sim' }, { valor: '0', rotulo: 'Não' }]

/** Tipo do input HTML; texto quando o formato brasileiro importa. */
function tipoHtml(c: Campo): string {
  if (c.tipo === 'email') return 'email'
  if (c.tipo === 'telefone') return 'tel'
  if (c.tipo === 'senha') return 'password'
  if (c.tipo === 'hora') return 'time'
  // Numeros vao como texto porque `type=number` recusa "1.234,56" — e a
  // virgula decimal e como se digita preco no Brasil.
  return 'text'
}

function CampoUm({ c, valor, erro, opcoes, modo }: {
  c: Campo; valor: string; erro?: string; opcoes: ListaOpcoes; modo: 'criar' | 'editar'
}) {
  const id = `f_${c.nome}`
  const borda = erro ? 'border-critical-600 focus:border-critical-600' : ''
  const travado = modo === 'editar' && c.imutavel

  const lista =
    c.tipo === 'referencia' ? (c.fonte ? opcoes[c.fonte] ?? [] : [])
    : c.tipo === 'booleano' ? (c.opcoes ?? SIM_NAO)
    : (c.opcoes ?? [])

  return (
    <div className={`col-span-1 ${LARGURA[c.col ?? 3]}`}>
      <label className="rotulo" htmlFor={id}>
        {c.rotulo}
        {c.obrigatorio && <span className="text-critical-600 ml-1" aria-hidden>*</span>}
      </label>

      {c.tipo === 'area' ? (
        <textarea id={id} name={c.nome} rows={3} maxLength={c.maxLen ?? 600}
          defaultValue={valor} className={`campo h-auto py-2 leading-relaxed ${borda}`} />

      ) : c.tipo === 'dias' ? (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {DIAS_SEMANA.map((d) => (
            <label key={d}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-ink-300
                         bg-white text-sm text-ink-700 cursor-pointer hover:border-ink-400
                         has-[:checked]:bg-ink-900 has-[:checked]:text-white has-[:checked]:border-ink-900">
              <input type="checkbox" name={c.nome} value={d} className="sr-only"
                     defaultChecked={valor.split(',').includes(d)} />
              {d}
            </label>
          ))}
        </div>

      ) : (c.tipo === 'select' || c.tipo === 'referencia' || c.tipo === 'booleano') ? (
        <select id={id} name={c.nome} defaultValue={valor} className={`campo ${borda}`}>
          {c.tipo !== 'booleano' && <option value="">— selecione —</option>}
          {lista.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>

      ) : (
        <input id={id} type={tipoHtml(c)} name={c.nome}
          defaultValue={travado ? undefined : valor}
          // Campo travado vai como `disabled`: o navegador nao envia o valor, e
          // o servidor ja ignora chave de negocio na edicao. As duas pontas
          // dizem a mesma coisa.
          value={travado ? valor : undefined}
          disabled={travado}
          readOnly={travado}
          maxLength={c.maxLen}
          inputMode={c.tipo === 'inteiro' ? 'numeric' : c.tipo === 'decimal' || c.tipo === 'moeda' ? 'decimal' : undefined}
          autoComplete={c.tipo === 'senha' ? 'new-password' : 'off'}
          placeholder={c.tipo === 'moeda' ? '0,00' : undefined}
          className={`campo ${borda} ${travado ? 'bg-ink-50 text-ink-500 cursor-not-allowed' : ''}`} />
      )}

      {erro
        ? <p className="text-xs text-critical-700 mt-1.5">{erro}</p>
        : c.ajuda && <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">{c.ajuda}</p>}
    </div>
  )
}

export function Formulario({ spec, modo, id, valores, erros, opcoes, voltar }: {
  spec: Especificacao
  modo: 'criar' | 'editar'
  id?: number
  /** Valores atuais: o registro do banco, sobrescrito pelo que foi digitado. */
  valores: Valores
  erros: Erros
  opcoes: ListaOpcoes
  voltar: string
}) {
  const geral = erros._
  const texto = (c: Campo) => {
    const v = valores[c.nome]
    if (v === null || v === undefined) return modo === 'criar' ? c.padrao ?? '' : ''
    return String(v)
  }

  return (
    <form method="post" action={`/api/registros/${spec.chave}`} className="space-y-4">
      <input type="hidden" name="_op" value={modo} />
      {id ? <input type="hidden" name="_id" value={id} /> : null}
      <input type="hidden" name="_voltar" value={voltar} />

      {geral && (
        <Aviso tom="critico" icone={<IconeAlerta size={16} />} titulo="Não foi possível gravar">
          {geral}
        </Aviso>
      )}

      <Painel>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-x-4 gap-y-5">
          {spec.campos.map((c) => (
            <CampoUm key={c.nome} c={c} modo={modo} opcoes={opcoes}
                     valor={texto(c)} erro={erros[c.nome]} />
          ))}
        </div>
      </Painel>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href={voltar} className="btn btn-secundario">Cancelar</Link>
        <button type="submit" className="btn btn-primario">
          {modo === 'criar' ? `Cadastrar ${spec.rotulo.toLowerCase()}` : 'Salvar alterações'}
        </button>
      </div>
    </form>
  )
}
