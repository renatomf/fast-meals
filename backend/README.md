# FastMeals — Backend

API REST em Fastify 5 e TypeScript, com PostgreSQL via Drizzle. Roda direto no Node 24, que executa TypeScript sem etapa de build (type stripping).

## Requisitos

- Node.js 24.22.1+ (linha 24; veja `../.nvmrc`)
- PostgreSQL acessível pela `DATABASE_URL`. O do Docker serve: `docker compose up -d db` o publica em `localhost:5433`

## Configuração

As variáveis ficam no `.env` da raiz do repositório:

```bash
cp ../.env.example ../.env
```

| Variável                 | Padrão                  | Descrição                                                         |
| ------------------------ | ----------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`           | — (obrigatória)         | Connection string do PostgreSQL                                   |
| `JWT_SECRET`             | — (obrigatória)         | Segredo do access token, com pelo menos 32 caracteres             |
| `JWT_REFRESH_SECRET`     | — (obrigatória)         | Segredo do refresh token; precisa ser diferente do `JWT_SECRET`   |
| `JWT_EXPIRES_IN`         | `15m`                   | Validade do access token (`s`, `m`, `h` ou `d`)                   |
| `JWT_REFRESH_EXPIRES_IN` | `7d`                    | Validade do refresh token                                         |
| `RATE_LIMIT_MAX`         | `100`                   | Requisições por minuto por IP (o login tem limite próprio de 10)  |
| `TRUST_PROXY_HOPS`       | `0`                     | Proxies confiáveis na frente da API; `1` atrás da nginx do Docker |
| `DEMO_MODE`              | `false`                 | `true` libera o cenário de demonstração do despacho               |
| `PORT`                   | `3001`                  | Porta HTTP                                                        |
| `HOST`                   | `0.0.0.0`               | Interface de escuta                                               |
| `NODE_ENV`               | `development`           | `development`, `test` ou `production`                             |
| `LOG_LEVEL`              | `info`                  | Nível do log Pino                                                 |
| `CORS_ORIGIN`            | `http://localhost:3000` | Origem autorizada no CORS                                         |

Uma variável ausente ou inválida impede o servidor de subir e a mensagem diz qual é.

## Comandos

```bash
npm install
npm run seed       # aplica as migrations e popula um banco vazio com seed/data.json
npm run dev        # http://localhost:3001, reinicia ao salvar
npm start          # sem watch
npm test           # precisa do PostgreSQL (veja "Testes")
npm run typecheck
npm run simulate   # com a API no ar: cria pedidos e avança a cozinha pela API, para ver o tempo real
```

### Banco de dados

| Comando                    | O que faz                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run seed`             | Aplica as migrations pendentes e carrega o `seed/data.json`. Num banco que já tem dados, não faz nada |
| `npm run seed -- --reset`  | Apaga tudo e carrega de novo. Os números se repetem a cada execução (gerador de semente fixa)         |
| `npm run seed:load`        | Acrescenta 10 mil pedidos encerrados nos últimos 90 dias, para os benchmarks de listagem e relatórios |
| `npm run demo:refresh`     | Traz o histórico de pedidos para perto de hoje, em dias inteiros. Só precisa do `DATABASE_URL`        |
| `npm run bench:assignment` | Tempo do Húngaro e do guloso em 50 × 30, 200 × 200 e 500 × 500                                        |
| `npm run bench:listings`   | Tempo das listagens e relatórios (rode `seed:load` antes)                                             |
| `npm run db:generate`      | Gera uma migration a partir das mudanças em `src/models` (`drizzle-kit`)                              |

O `data.json` não tem datas. O seed coloca os pedidos encerrados em horários de almoço e jantar dos últimos 30 dias e faz os pedidos em aberto terminarem a linha do tempo poucos minutos antes da execução. Cada pedido ganha um histórico de status coerente com o status final.

No Docker, o container roda o seed antes de subir a API; como ele não toca num banco populado, reiniciar o container não perde dados.

### Testes

Os testes de integração usam um PostgreSQL de verdade, num banco separado (`fastmeals_test`), criado e migrado automaticamente na primeira execução. Por padrão eles usam o banco do Docker:

```bash
docker compose up -d db   # na raiz do repositório
npm test
```

Para outro servidor, aponte `TEST_DATABASE_URL` para ele.

## Endpoints disponíveis

| Rota                                             | Descrição                                                                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`                           | Email e senha → access token, refresh token e usuário                                                                                       |
| `POST /api/auth/refresh`                         | Refresh token (corpo ou cookie) → novo par de tokens; o token usado é revogado                                                              |
| `POST /api/auth/logout`                          | Revoga a sessão e limpa o cookie                                                                                                            |
| `GET /api/auth/me`                               | Usuário dono do access token                                                                                                                |
| `GET /api/products`                              | Lista com paginação, busca por nome, filtros e ordenação                                                                                    |
| `GET`, `PUT`, `DELETE /api/products/:id`         | Detalhe, edição parcial e exclusão (409 se estiver em pedido aberto)                                                                        |
| `POST /api/products`                             | Cria produto                                                                                                                                |
| `GET /api/orders`                                | Lista com paginação, filtros de status e período e ordenação                                                                                |
| `GET /api/orders/:id`, `/:id/history`            | Detalhe e linha do tempo de status                                                                                                          |
| `POST /api/orders`                               | Cria pedido; total calculado no servidor                                                                                                    |
| `PATCH /api/orders/:id/status`                   | Muda o status pelas 7 transições permitidas                                                                                                 |
| `PATCH /api/orders/:id/assign`                   | Atribui entregador a um pedido `ready`                                                                                                      |
| `GET`, `POST /api/delivery-persons`              | Lista (filtros `isActive` e `available`) e cadastro                                                                                         |
| `GET`, `PUT`, `DELETE /api/delivery-persons/:id` | Detalhe, edição parcial e remoção (409 se estiver em pedido em andamento)                                                                   |
| `POST /api/orders/optimize-assignment`           | Sugere a atribuição de entregadores que minimiza a distância total (algoritmo Húngaro)                                                      |
| `POST /api/dispatch/demo-scenario`               | Cria um cenário em que o guloso perde (só com `DEMO_MODE=true`)                                                                             |
| `GET /api/reports/revenue`                       | Receita dos pedidos entregues por dia (período obrigatório)                                                                                 |
| `GET /api/reports/orders-by-status`              | Pedidos em cada status                                                                                                                      |
| `GET /api/reports/top-products`                  | Produtos mais vendidos                                                                                                                      |
| `GET /api/reports/average-delivery-time`         | Tempo médio de entrega, geral e por veículo                                                                                                 |
| `GET /api/health`                                | Status da API e do banco (200 ou 503)                                                                                                       |
| `GET /api/docs`                                  | Swagger UI, gerado a partir dos schemas Zod                                                                                                 |
| `GET /ws` (WebSocket)                            | Avisos de mudança em pedidos, produtos e entregadores; o token vai na primeira mensagem ([ADR 0005](../docs/adr/0005-real-time-updates.md)) |

Dez senhas erradas para o mesmo email em 15 minutos bloqueiam aquele email até o fim da janela, mesmo vindo de IPs diferentes ([ADR 0004](../docs/adr/0004-token-storage-and-rotation.md)). Reiniciar a API zera o contador.

Todas as rotas fora de `/api/auth`, `/api/health` e `/api/docs` exigem o header `Authorization: Bearer <accessToken>`. O viewer lê tudo; criar, editar, excluir, mudar status e atribuir exigem o perfil admin.

Credenciais do seed: `admin@fastmeals.com` / `Admin@123` e `viewer@fastmeals.com` / `Viewer@123`.

O refresh token vem no corpo, como no `api-spec`, e também num cookie `httpOnly` restrito a `/api/auth`. O front usa só o cookie. O motivo e a defesa contra CSRF estão no [ADR 0004](../docs/adr/0004-token-storage-and-rotation.md).

## Tempo real e cache

Um trigger no PostgreSQL publica cada mudança confirmada em pedidos, produtos e entregadores (`NOTIFY`). A API escuta numa conexão dedicada e repassa pelo WebSocket `/ws`; o mesmo aviso limpa o cache em memória dos relatórios. Detalhes, alternativas e limites no [ADR 0005](../docs/adr/0005-real-time-updates.md).

## Organização

Segue as pastas sugeridas no enunciado, com os arquivos de cada domínio agrupados por módulo:

```
src/
├── server.ts        bootstrap e graceful shutdown
├── app.ts           montagem da aplicação (composition root)
├── config/          validação do ambiente
├── db/              conexão, migrator e seed
├── models/          definição das tabelas (Drizzle)
├── middlewares/     autenticação, autorização e tratamento de erros
├── algorithms/      Haversine e algoritmo Húngaro, sem dependência de HTTP ou banco
├── utils/           erros de domínio e funções puras (dinheiro em centavos)
└── modules/<domínio>/
    ├── <domínio>.routes.ts       rotas e schemas de entrada/saída
    ├── <domínio>.controller.ts   traduz HTTP para chamadas ao service
    ├── <domínio>.service.ts      regras de negócio (única porta de entrada do módulo)
    └── <domínio>.repository.ts   acesso ao banco
drizzle/             migrations SQL, aplicadas em ordem
tests/               testes de integração e unitários
```

As fronteiras entre camadas são verificadas pelo ESLint. Uma rota ou controller não acessa o banco diretamente, um algoritmo não importa Fastify e um módulo só usa outro pelo `*.service.ts` dele.
