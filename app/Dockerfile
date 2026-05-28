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
# IMPORTANT : start-period long (3 min) parce qu'au démarrage on doit
# télécharger Prisma 5.22 (npx), appliquer les migrations puis démarrer Next.
# Avec 20s on tombait en timeout avant que Next soit prêt → rollback Coolify.
HEALTHCHECK --interval=15s --timeout=5s --start-period=180s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

# Appliquer migrations Prisma au démarrage puis lancer Next standalone.
# IMPORTANT : pin de la version 5.22 — sans ça, npx télécharge la dernière
# (Prisma 7+) qui a une API incompatible avec notre schema (url = env(...)).
CMD ["sh", "-c", "npx prisma@5.22.0 migrate deploy && node server.js"]
