# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────
# Dasohub — Image de production Next.js 14 (output: standalone)
# Multi-stage : deps → build → runtime
# Image finale ~150 MB, utilisateur non-root, healthcheck inclus.
# ─────────────────────────────────────────────────────────────

# ─── Stage 1 : dépendances (cache aggressif) ───
FROM node:20-alpine AS deps
WORKDIR /app

# libc6-compat + openssl nécessaires à Prisma sur Alpine
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --include=dev

# ─── Stage 2 : build ───
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Stage 3 : runtime minimal ───
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl wget

# Utilisateur non-root (sécurité)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Output standalone Next.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Client Prisma + schéma pour les migrations runtime
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

# Healthcheck pour Coolify
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

# Appliquer migrations Prisma au démarrage puis lancer Next standalone
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
