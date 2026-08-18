'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { IconeMenu, IconeFechar, IconePorta } from './icones'

export type ItemNav = { href: string; rotulo: string; icone: ReactNode; exato?: boolean }
export type SecaoNav = { titulo: string; itens: ItemNav[] }

function useAtivo() {
  const caminho = usePathname()
  return (i: ItemNav) =>
    i.exato ? caminho === i.href : caminho === i.href || caminho.startsWith(i.href + '/')
}

/* ------------------------------------------------ lista de navegacao */
export function Navegacao({ secoes, aoNavegar }: { secoes: SecaoNav[]; aoNavegar?: () => void }) {
  const ativo = useAtivo()
  return (
    <nav className="px-3 pb-6">
      {secoes.map((s) => (
        <div key={s.titulo}>
          <p className="nav-secao">{s.titulo}</p>
          <ul className="space-y-0.5">
            {s.itens.map((i) => {
              const on = ativo(i)
              return (
                <li key={i.href}>
                  <Link href={i.href} onClick={aoNavegar}
                        aria-current={on ? 'page' : undefined}
                        className={`nav-item ${on ? 'nav-item-ativo' : ''}`}>
                    <span className={on ? 'text-petrol-700' : 'text-ink-400'}>{i.icone}</span>
                    <span className="truncate">{i.rotulo}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/* ------------------------------------------------ gaveta no celular */
export function MenuMobile({ secoes }: { secoes: SecaoNav[] }) {
  const [aberto, setAberto] = useState(false)
  const caminho = usePathname()

  // fecha ao trocar de rota e ao apertar Esc; trava a rolagem do fundo
  useEffect(() => { setAberto(false) }, [caminho])
  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('keydown', onKey)
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = anterior }
  }, [aberto])

  return (
    <>
      <button type="button" onClick={() => setAberto(true)}
              aria-label="Abrir menu de navegação" aria-expanded={aberto}
              className="btn btn-sutil btn-icone lg:hidden -ml-1.5">
        <IconeMenu size={18} />
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Fechar menu" onClick={() => setAberto(false)}
                  className="absolute inset-0 bg-ink-950/40" />
          <div className="absolute inset-y-0 left-0 w-[270px] max-w-[85vw] bg-white border-r border-ink-200
                          flex flex-col shadow-pop">
            <div className="h-14 flex items-center justify-between px-4 border-b border-ink-200 shrink-0">
              <span className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded bg-ink-900 text-white grid place-items-center text-[11px] font-bold">S</span>
                <span className="text-sm font-semibold tracking-tight">SUPRA</span>
              </span>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar menu"
                      className="btn btn-sutil btn-icone btn-sm">
                <IconeFechar size={17} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <Navegacao secoes={secoes} aoNavegar={() => setAberto(false)} />
            </div>
            <div className="border-t border-ink-200 p-3 shrink-0">
              <Link href="/" className="nav-item" onClick={() => setAberto(false)}>
                <span className="text-ink-400"><IconePorta size={16} /></span>
                <span>Trocar perfil</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
