/** @type {import('next').NextConfig} */

// A aplicacao nao carrega script, fonte nem imagem de terceiros: todo o CSS e
// JS sai do proprio build. Isso permite uma CSP estreita de verdade. O
// 'unsafe-inline' em style-src e exigencia do Next, que injeta <style> inline
// no HTML da pagina; ja script-src fica sem ele, com 'strict-dynamic' e o
// nonce que o proprio Next aplica aos seus scripts.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ')

const CABECALHOS = [
  { key: 'Content-Security-Policy', value: CSP },
  // O Traefik so publica esta aplicacao em https; o cabecalho instrui o
  // navegador a nem tentar a primeira requisicao em texto claro.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

const nextConfig = {
  reactStrictMode: true,
  // imagem enxuta para o Coolify: o Next monta um servidor auto-contido
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  // nao anunciar a stack para quem varre a internet
  poweredByHeader: false,
  compress: true,
  experimental: {
    // node:sqlite e o modulo de dados sao sempre resolvidos no servidor
    serverComponentsExternalPackages: ['node:sqlite', 'pg'],
  },
  async headers() {
    return [{ source: '/:caminho*', headers: CABECALHOS }]
  },
}
export default nextConfig
