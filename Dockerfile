# =====================================================================
# SUPRA — imagem de producao
# Multi-stage: instala, compila em modo standalone e roda em node:22-alpine.
# =====================================================================

# ---------- dependencias ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- build ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S supra -G nodejs

# Servidor auto-contido gerado pelo Next
COPY --from=builder --chown=supra:nodejs /app/.next/standalone ./
COPY --from=builder --chown=supra:nodejs /app/.next/static ./.next/static

# Scripts de carga da base (o pg ja vem tracado no standalone)
COPY --from=builder --chown=supra:nodejs /app/scripts ./scripts

COPY --chown=supra:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && mkdir -p data && chown supra:nodejs data

USER supra
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
