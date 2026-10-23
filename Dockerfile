FROM node:26-alpine AS base

# ── build-base: base + yarn (Node 25+ images no longer bundle yarn or corepack) ─
FROM base AS build-base
# yarn.lock is Classic (v1) format, which `--frozen-lockfile` below also assumes
RUN npm install -g yarn@1.22.22

# ── deps: install all dependencies ────────────────────────────────────────────
FROM build-base AS deps
# libc6-compat is required for some native modules on Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# ── builder: compile the Next.js app ──────────────────────────────────────────
FROM build-base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

# ── runner: minimal runtime image ─────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# public/ contains the pre-generated question JSON — required at runtime
COPY --from=builder /app/public ./public

# standalone output bundles only the needed server code and node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
