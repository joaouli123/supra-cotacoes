import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SUPRA — Plataforma de Cotações Corporativas',
  description:
    'Plataforma SaaS multiempresa para gestão de compras: cadastros, demandas, disparo programado de cotações, portal do fornecedor, equalização automática de preços e integração bidirecional com ERPs.',
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' }

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
