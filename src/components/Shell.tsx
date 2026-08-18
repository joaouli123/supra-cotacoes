import Link from 'next/link'
import { sessao, empresas, ROTULO_PERFIL, type Perfil } from '@/lib/sessao'
import { Navegacao, MenuMobile, type SecaoNav } from './Navegacao'
import { iniciais } from '@/lib/formato'
import {
  IconePainel, IconeCaixa, IconeFabrica, IconePessoas, IconeCaminhao, IconeLista,
  IconeBalanca, IconeRelogio, IconeConector, IconeEscudo, IconePredio, IconeChevron,
  IconeArquitetura, IconePorta, IconeCheck,
} from './icones'

function secoesPara(perfil: Perfil): SecaoNav[] {
  const geral: SecaoNav = {
    titulo: 'Geral',
    itens: [{ href: '/painel', rotulo: 'Visão geral', icone: <IconePainel size={16} />, exato: true }],
  }
  const suprimentos: SecaoNav = {
    titulo: 'Suprimentos',
    itens: [
      { href: '/demandas', rotulo: 'Demandas', icone: <IconeLista size={16} /> },
      { href: '/cotacoes', rotulo: 'Cotações', icone: <IconeBalanca size={16} /> },
      { href: '/agendamentos', rotulo: 'Disparos programados', icone: <IconeRelogio size={16} /> },
    ],
  }
  const cadastros: SecaoNav = {
    titulo: 'Cadastros',
    itens: [
      { href: '/materiais', rotulo: 'Materiais', icone: <IconeCaixa size={16} /> },
      { href: '/fornecedores', rotulo: 'Fornecedores', icone: <IconeFabrica size={16} /> },
      { href: '/clientes', rotulo: 'Clientes', icone: <IconePessoas size={16} /> },
      { href: '/transportadoras', rotulo: 'Transportadoras', icone: <IconeCaminhao size={16} /> },
    ],
  }
  const plataforma: SecaoNav = {
    titulo: 'Plataforma',
    itens: [
      { href: '/integracoes', rotulo: 'Integrações ERP', icone: <IconeConector size={16} /> },
      { href: '/auditoria', rotulo: 'Auditoria', icone: <IconeEscudo size={16} /> },
      { href: '/empresas', rotulo: 'Empresas', icone: <IconePredio size={16} /> },
      { href: '/arquitetura', rotulo: 'Arquitetura', icone: <IconeArquitetura size={16} /> },
    ],
  }

  if (perfil === 'comprador') {
    return [geral, { ...suprimentos, itens: suprimentos.itens.slice(0, 2) }, cadastros,
      { titulo: 'Plataforma', itens: [plataforma.itens[3]] }]
  }
  if (perfil === 'gestor') {
    return [geral, suprimentos, cadastros,
      { titulo: 'Plataforma', itens: plataforma.itens.filter((i) => i.href !== '/empresas') }]
  }
  return [geral, suprimentos, cadastros, plataforma]
}

export async function Shell({ children }: { children: React.ReactNode }) {
  const s = await sessao()
  const listaEmpresas = await empresas()
  const secoes = secoesPara(s.perfil)
  const podeTrocarEmpresa = s.perfil === 'admin_central'

  return (
    <div className="min-h-screen bg-ink-50">
      {/* ------------------------------------------------- lateral fixa */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[244px] flex-col bg-white border-r border-ink-200 z-30">
        <div className="h-14 flex items-center px-5 border-b border-ink-200 shrink-0">
          <Link href="/painel" className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded bg-ink-900 text-white grid place-items-center text-[11px] font-bold tracking-tight">S</span>
            <span className="text-sm font-semibold tracking-tight text-ink-900">SUPRA</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Navegacao secoes={secoes} />
        </div>
        <div className="border-t border-ink-200 p-3 shrink-0">
          <Link href="/" className="nav-item">
            <span className="text-ink-400"><IconePorta size={16} /></span>
            <span>Trocar perfil</span>
          </Link>
        </div>
      </aside>

      <div className="lg:pl-[244px]">
        {/* ---------------------------------------------- barra superior */}
        <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur border-b border-ink-200
                           flex items-center gap-2 sm:gap-3 px-3 sm:px-5">
          <MenuMobile secoes={secoes} />

          <Link href="/painel" className="lg:hidden flex items-center gap-2 shrink-0">
            <span className="w-6 h-6 rounded bg-ink-900 text-white grid place-items-center text-[11px] font-bold">S</span>
            <span className="text-sm font-semibold hidden sm:block">SUPRA</span>
          </Link>

          {/* contexto de empresa */}
          {s.empresa && (
            <details className="relative min-w-0">
              <summary className="list-none cursor-pointer flex items-center gap-2 h-9 px-2.5 rounded-md
                                  border border-ink-200 hover:bg-ink-50 hover:border-ink-300
                                  transition-colors max-w-[52vw] sm:max-w-[300px]">
                <span className="w-5 h-5 rounded bg-petrol-100 text-petrol-800 grid place-items-center text-[9px] font-bold shrink-0">
                  {iniciais(s.empresa.nome_fantasia)}
                </span>
                <span className="text-sm font-medium text-ink-900 truncate">{s.empresa.nome_fantasia}</span>
                <IconeChevron size={14} className="text-ink-400 shrink-0" />
              </summary>
              <div className="absolute left-0 top-full mt-1.5 w-[300px] max-w-[88vw] bg-white border border-ink-200
                              rounded-lg shadow-pop py-1.5 max-h-[70vh] overflow-y-auto z-30">
                <p className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-400">
                  Empresas na plataforma
                </p>
                {listaEmpresas.map((e) => {
                  const atual = e.id === s.empresa!.id
                  return (
                    <a key={e.id} href={`/api/contexto?empresa=${e.id}&voltar=/painel`}
                       className={`flex items-start gap-2.5 px-3 py-2 hover:bg-ink-50 ${atual ? 'bg-ink-50' : ''}`}>
                      <span className="w-5 h-5 mt-0.5 rounded bg-ink-100 text-ink-600 grid place-items-center text-[9px] font-bold shrink-0">
                        {iniciais(e.nome_fantasia)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-ink-900 truncate">{e.nome_fantasia}</span>
                        <span className="block text-xs text-ink-500 truncate">{e.segmento} · {e.cidade}/{e.uf}</span>
                      </span>
                      {atual && <IconeCheck size={15} className="text-petrol-700 mt-0.5 shrink-0" />}
                    </a>
                  )
                })}
                {!podeTrocarEmpresa && (
                  <p className="px-3 pt-2 mt-1 border-t border-ink-100 text-xs text-ink-500">
                    Somente o administrador da plataforma alterna entre empresas.
                  </p>
                )}
              </div>
            </details>
          )}

          <div className="flex-1" />

          {/* usuario da sessao */}
          <details className="relative shrink-0">
            <summary className="list-none cursor-pointer flex items-center gap-2.5 h-9 pl-1 pr-1.5 sm:pr-2
                                rounded-md hover:bg-ink-50 transition-colors">
              <span className="w-7 h-7 rounded-full bg-ink-900 text-white grid place-items-center text-[10px] font-semibold shrink-0">
                {iniciais(s.usuario.nome)}
              </span>
              <span className="hidden md:block text-left leading-tight max-w-[150px]">
                <span className="block text-xs font-medium text-ink-900 truncate">
                  {s.usuario.nome.split(' ').slice(0, 2).join(' ')}
                </span>
                <span className="block text-2xs text-ink-500 truncate">{s.usuario.cargo}</span>
              </span>
              <IconeChevron size={14} className="text-ink-400 hidden sm:block" />
            </summary>
            <div className="absolute right-0 top-full mt-1.5 w-[290px] max-w-[88vw] bg-white border border-ink-200
                            rounded-lg shadow-pop py-1.5 z-30">
              <div className="px-3 py-2 border-b border-ink-100">
                <p className="text-sm font-medium text-ink-900 truncate">{s.usuario.nome}</p>
                <p className="text-xs text-ink-500 truncate">{s.usuario.email}</p>
                <p className="mt-1.5 text-2xs text-petrol-800 bg-petrol-100 inline-block px-1.5 py-0.5 rounded">
                  {ROTULO_PERFIL[s.perfil]}
                </p>
              </div>
              <p className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-400">
                Alternar perfil de acesso
              </p>
              {(['admin_central', 'gestor', 'comprador', 'fornecedor'] as Perfil[]).map((p) => (
                <a key={p} href={`/api/contexto?perfil=${p}&voltar=${p === 'fornecedor' ? '/portal' : '/painel'}`}
                   className={`flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-ink-50
                               ${p === s.perfil ? 'text-ink-900 font-medium' : 'text-ink-600'}`}>
                  {ROTULO_PERFIL[p]}
                  {p === s.perfil && <IconeCheck size={15} className="text-petrol-700 shrink-0" />}
                </a>
              ))}
            </div>
          </details>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1600px]">{children}</main>
      </div>
    </div>
  )
}
