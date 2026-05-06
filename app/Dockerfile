# --- Build ---
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

# --- Runner ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.mjs ./
EXPOSE 3000
CMD ["sh","-c","npx prisma migrate deploy && npm run start"]
