# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────
# Dasohub — Image de production Next.js 14 (output: standalone)
# Multi-stage : deps → build → runtime
# Image finale ~150 MB, utilisateur non-root, healthcheck inclus.
# ─────────────────────────────────────────────────────────────

# ─── Stage 1 : dépendances + build (fusionné pour éviter COPY node_modules 77s) ───
# Auparavant on avait 2 stages (deps → builder) avec un COPY --from=deps node_modules
# qui prenait ~1min15 (200+ MB à copier). En fusionnant, on économise cette copie.
# Le runtime stage 2 ne prend que .next/standalone (~50 MB), donc l'image finale
# reste minimale.
FROM node:20-alpine AS builder
WORKDIR /app

# libc6-compat + openssl nécessaires à Prisma sur Alpine
RUN apk add --no-cache libc6-compat openssl

# Étape 1 : installer les dépendances (cache mount .npm)
COPY package.json package-lock.json* ./
COPY prisma ./prisma
# On utilise `npm install` (pas `npm ci`) pour tolérer un lockfile légèrement
# désynchronisé après ajout de deps. Le cache mount BuildKit persiste les tarballs
# entre builds : gain typique 2-4 min → 15-20 sec sur builds successifs.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install --no-audit --no-fund --include=dev

# Étape 2 : copier le code source et builder
COPY . .

RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
# Cache mount pour le cache webpack/turbopack de Next.js.
# Sur des builds incrémentaux, gain 1-2 min car seul le code modifié recompile.
RUN --mount=type=cache,target=/app/.next/cache,sharing=locked \
    npm run build

# ─── Stage 3 : runtime minimal ───
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl wget

# Utilisateur non-root (sécurité)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Pré-création du dossier de stockage des documents avec les bonnes permissions.
# Si un volume Docker est monté ici, Docker préserve ces ownership pour les
# volumes nommés ; pour les bind mounts hôtes il faut aussi chown côté VPS.
RUN mkdir -p /data/documents && chown -R nextjs:nodejs /data

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Chemin du stockage documents (override possible via env Coolify si besoin)
ENV DOCS_STORAGE_PATH=/data/documents

# Output standalone Next.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Client Prisma + schéma pour les migrations runtime
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
# CLI Prisma bundled dans l'image → plus de `npx prisma@5.22.0` qui télécharge
# le binaire à chaque démarrage. Gain : ~30s par boot + start-period plus court.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

# Healthcheck pour Coolify
# - 127.0.0.1 (pas localhost) pour éviter résolution IPv6 (::1) où Next n'écoute pas.
# - start-period 30s : le seed tourne en background (non-bloquant), donc l'app
#   répond dès que Next.js écoute (~10-15s). Marge x2 pour sécurité.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD wget --quiet --tries=1 -O /dev/null http://127.0.0.1:3000/api/health || exit 1

# Séquence de démarrage :
# 1. migrate deploy — SYNCHRONE : les nouvelles pages peuvent dépendre du schema
# 2. seed-training  — ASYNCHRONE en arrière-plan : ~30-60s d'upserts qui ne
#    doivent PAS bloquer le healthcheck /api/health (le healthcheck teste juste
#    la DB, pas la présence des cours). Coolify voit l'app "healthy" dès que
#    Next.js écoute, sans attendre la fin du seed.
# 3. server.js      — SYNCHRONE : c'est le processus principal (PID 1)
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && (node prisma/seed-training.mjs > /tmp/seed.log 2>&1 &) && node server.js"]
