# Andy's Coffee API — production image (Render builds it from backend/).
# Configuration comes from the host's environment variables: no .env file, certificate or
# secret is copied into the image (see .dockerignore and docs/deployment.md).

# ---------- Build: dependencies, Prisma client and esbuild bundle ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# openssl lets Prisma detect the right query-engine binary.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src
# prisma.config.ts requires a URL to load; generate never connects to it.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
  && npm run build \
  && test -s dist/server.js \
  && npm prune --omit=dev \
  # @prisma/client declares the `prisma` CLI and `typescript` as peer dependencies, so npm keeps
  # them (and their tree: config, engines, effect, jiti, c12) even without dev deps. At runtime
  # only the generated client in node_modules/.prisma is used: drop the CLI tree (~165 MB) so
  # the image cannot run migrations or compile TypeScript.
  && rm -rf node_modules/prisma node_modules/typescript node_modules/@prisma/config \
    node_modules/@prisma/engines node_modules/effect node_modules/fast-check node_modules/jiti \
    node_modules/c12 node_modules/.bin/prisma node_modules/.bin/tsc node_modules/.bin/tsserver \
    node_modules/.bin/jiti \
  && test -d node_modules/.prisma/client

# ---------- Runtime: only production dependencies and the bundle ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
  PORT=4000

COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma/schema.prisma ./prisma/schema.prisma

USER node
EXPOSE 4000

# /health does not touch the database; it only tells whether the process serves HTTP.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--enable-source-maps", "dist/server.js"]
