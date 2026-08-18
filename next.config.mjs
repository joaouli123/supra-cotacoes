/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // imagem enxuta para o Coolify: o Next monta um servidor auto-contido
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // node:sqlite e o modulo de dados sao sempre resolvidos no servidor
    serverComponentsExternalPackages: ['node:sqlite', 'pg'],
  },
}
export default nextConfig
