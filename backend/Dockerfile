# Contexto de build: raiz do repositório (o backend depende do workspace packages/contracts).

FROM node:24.22.1-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages/contracts/package.json packages/contracts/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev --workspace @fastmeals/backend

FROM node:24.22.1-alpine AS runtime
ENV NODE_ENV=production
# O runtime só executa `node`. npm, npx, corepack e yarn vêm na imagem base e trazem
# dependências próprias com CVEs (undici, brace-expansion...); fora daqui, fora do scan.
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
    /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
WORKDIR /app
COPY --from=deps --chown=node:node /app ./
COPY --chown=node:node packages/contracts packages/contracts
COPY --chown=node:node backend backend
USER node
WORKDIR /app/backend
EXPOSE 3001
# Sem etapa de build: o Node 24 executa TypeScript direto (type stripping).
CMD ["node", "src/server.ts"]
