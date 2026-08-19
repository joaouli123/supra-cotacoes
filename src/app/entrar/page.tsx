import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { COOKIE_SESSAO, lerCracha } from '@/lib/auth'
import { contar } from '@/lib/db'
import { numero } from '@/lib/formato'
import { IconeCadeado, IconeSeta, IconeEmail, IconeEscudo } from '@/components/icones'

export const dynamic = 'force-dynamic'

const MENSAGENS: Record<string, string> = {
  credencial: 'E-mail ou senha incorretos.',
  vazio: 'Preencha o e-mail e a senha.',
  inativo: 'Esta conta está desativada. Procure o administrador da plataforma.',
  expirada: 'Sua sessão expirou. Entre novamente.',
  origem: 'Requisição recusada por vir de outro endereço. Entre pela própria página.',
}

export default async function Entrar({
  searchParams,
}: {
  searchParams: { erro?: string; voltar?: string }
}) {
  if (lerCracha(cookies().get(COOKIE_SESSAO)?.value)) redirect('/painel')

  const erro = searchParams.erro ? MENSAGENS[searchParams.erro] ?? MENSAGENS.credencial : null
  const voltar = searchParams.voltar?.startsWith('/') ? searchParams.voltar : '/painel'

  const materiais = await contar('select count(*) c from materiais')
  const fornecedores = await contar('select count(*) c from fornecedores')
  const cotacoes = await contar('select count(*) c from cotacoes')

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col">
      <div className="flex-1 grid lg:grid-cols-[1fr_1.05fr]">

        {/* ------------------------------------------------ formulario */}
        <div className="flex items-center justify-center px-5 sm:px-8 py-10 lg:py-16">
          <div className="w-full max-w-[380px]">
            <Link href="/" className="flex items-center gap-2.5 mb-9">
              <span className="w-7 h-7 rounded bg-ink-900 text-white grid place-items-center text-xs font-bold">S</span>
              <span className="text-sm font-semibold tracking-tight text-ink-900">SUPRA</span>
            </Link>

            <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-ink-900">
              Entrar na plataforma
            </h1>
            <p className="mt-2 text-sm text-ink-500">
              Acesso restrito à operação de suprimentos.
            </p>

            {erro && (
              <div role="alert"
                   className="mt-6 flex gap-2.5 rounded-md border border-critical-100 bg-critical-100/60 px-3.5 py-3">
                <span className="text-critical-700 mt-px shrink-0"><IconeEscudo size={15} /></span>
                <p className="text-sm text-critical-700">{erro}</p>
              </div>
            )}

            <form method="post" action="/api/entrar" className="mt-6 space-y-4">
              <input type="hidden" name="voltar" value={voltar} />

              <div>
                <label htmlFor="email" className="rotulo">E-mail</label>
                <input id="email" name="email" type="email" required autoFocus
                       autoComplete="username" spellCheck={false}
                       placeholder="voce@empresa.com.br" className="campo" />
              </div>

              <div>
                <label htmlFor="senha" className="rotulo">Senha</label>
                <input id="senha" name="senha" type="password" required
                       autoComplete="current-password" placeholder="••••••••" className="campo" />
              </div>

              <button type="submit" className="btn btn-primario w-full justify-center">
                <IconeCadeado size={15} />Entrar
                <IconeSeta size={15} />
              </button>
            </form>

            <p className="mt-6 pt-5 border-t border-ink-200 text-xs text-ink-500 leading-relaxed">
              Fornecedor não entra por aqui: o acesso ao portal externo é feito
              pelo link do convite recebido por e-mail, que já identifica a cotação.
            </p>
          </div>
        </div>

        {/* ------------------------------------------------ apresentacao */}
        <div className="hidden lg:flex flex-col justify-center bg-ink-900 text-white px-14 py-16">
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-white/50 mb-4">
            Plataforma de cotações corporativas
          </p>
          <h2 className="text-[30px] leading-[1.15] font-semibold tracking-tight max-w-md">
            Da demanda de compra à equalização, em uma base só.
          </h2>
          <p className="mt-5 text-sm text-white/60 leading-relaxed max-w-md">
            Multiempresa, com portal externo do fornecedor, disparo programado de
            cotações e equalização que considera frete, impostos, prazo de entrega
            e condição de pagamento.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-6 max-w-md">
            {([
              ['Materiais', materiais],
              ['Fornecedores', fornecedores],
              ['Cotações', cotacoes],
            ] as const).map(([rotulo, valor]) => (
              <div key={rotulo}>
                <dt className="text-2xs font-semibold uppercase tracking-wider text-white/40">{rotulo}</dt>
                <dd className="mt-1 text-xl font-semibold tabular">{numero(valor)}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-10 flex items-center gap-2 text-xs text-white/40">
            <IconeEmail size={14} />Suporte pelo administrador da plataforma
          </p>
        </div>
      </div>
    </div>
  )
}
