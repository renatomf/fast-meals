# Contexto de build: raiz do repositório (o front depende do workspace packages/contracts).

FROM node:26.12.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages/contracts/package.json packages/contracts/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace @fastmeals/frontend --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY frontend frontend
RUN npm run build --workspace @fastmeals/frontend

FROM nginx:1.30.6-alpine AS runtime
# Só servimos arquivos estáticos e fazemos proxy: curl e os módulos xslt/njs (que puxam
# libxml2) não são carregados e só aumentam a superfície de ataque.
RUN apk upgrade --no-cache \
  && apk del --no-cache curl nginx-module-xslt nginx-module-njs libxslt libxml2
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 3000
