# Contexto de build: raiz do repositório (o front depende do workspace packages/contracts).

FROM node:24.22.1-alpine AS build
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

FROM nginx:1.31.7-alpine AS runtime
# Só servimos arquivos estáticos e fazemos proxy: curl e os módulos xslt/njs (que puxam
# libxml2) não são carregados e só aumentam a superfície de ataque.
RUN apk upgrade --no-cache \
  && apk del --no-cache curl nginx-module-xslt nginx-module-njs libxslt libxml2
# Template: o entrypoint da imagem oficial troca ${API_UPSTREAM} pelo valor do ambiente ao subir.
# O padrão serve o docker compose; num deploy, a variável aponta para a URL da API.
ENV API_UPSTREAM=http://backend:3001
COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 3000
