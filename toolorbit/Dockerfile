# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# ToolOrbit production image (multi-stage, non-root, Next.js standalone).
#   target "runner": the web app (small image, no dev dependencies)
#   target "tools":  full toolchain for migrations, seeding and admin CLI
# ---------------------------------------------------------------------------
ARG NODE_VERSION=22.22.0

FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM deps AS builder
COPY . .
# Public, build-time values (safe to bake into the client bundle).
ARG NEXT_PUBLIC_IPV6_TEST_URL=""
ARG APP_VERSION="dev"
ENV NEXT_PUBLIC_IPV6_TEST_URL=${NEXT_PUBLIC_IPV6_TEST_URL} APP_VERSION=${APP_VERSION} NODE_ENV=production
RUN npx prisma generate && npm run build

# Toolchain image: prisma migrate, seed, admin:create.
FROM deps AS tools
COPY . .
RUN npx prisma generate
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
ARG APP_VERSION="dev"
ENV APP_VERSION=${APP_VERSION}
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && mkdir -p .next/cache && chown -R node:node .next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
CMD ["node", "server.js"]
