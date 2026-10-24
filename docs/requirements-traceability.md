# Rastreabilidade de requisitos

Cada exigência do [enunciado](challenge.md), da [especificação da API](api-spec.md), do [schema de referência](database-schema.md) e dos [critérios de avaliação](evaluation-criteria.md), com o lugar onde foi atendida e o teste que a cobre. Atualizo este arquivo a cada entrega.

Legenda: ✅ entregue · 🔄 em andamento · ⏳ planejado

## Critérios eliminatórios

| ID    | Critério                                                                             | Status | Onde / como é garantido                                                                                                                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ELI-1 | Compila e roda com as instruções                                                     | ✅     | `docker compose up --build` e o caminho sem Docker validados em clone limpo; job `docker` do CI sobe a stack com o mesmo comando                                                                                                                        |
| ELI-2 | Nenhum JavaScript puro                                                               | ✅     | Configs em `.ts`; [`scripts/check-no-js.ts`](../scripts/check-no-js.ts) no CI                                                                                                                                                                           |
| ELI-3 | Existem testes                                                                       | 🔄     | [`backend/tests`](../backend/tests): 78 testes até agora; mínimos em TST-1 e TST-2                                                                                                                                                                      |
| ELI-4 | Código gerado por IA com entendimento                                                | 🔄     | Seção "Uso de IA" no [`DECISIONS.md`](../DECISIONS.md)                                                                                                                                                                                                  |
| ELI-5 | `DECISIONS.md` presente                                                              | ✅     | [`DECISIONS.md`](../DECISIONS.md)                                                                                                                                                                                                                       |
| ELI-6 | PostgreSQL                                                                           | ✅     | PostgreSQL 18.6 ([`docker/postgres`](../docker/postgres/Dockerfile))                                                                                                                                                                                    |
| ELI-7 | Sem vulnerabilidades graves (SQL injection, senha em texto puro, token sem httpOnly) | 🔄     | bcrypt custo 12, refresh token só em cookie httpOnly ([ADR 0004](adr/0004-token-storage-and-rotation.md)) e queries parametrizadas pelo Drizzle; imagens e dependências sem CVE corrigível. Falta aplicar o mesmo padrão às rotas de produtos e pedidos |

## Stack e qualidade de código

| ID    | Requisito                                        | Status | Onde                                                                                                             |
| ----- | ------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------- |
| STK-1 | React 18+ com TypeScript                         | ✅     | React 19.3 ([`frontend`](../frontend))                                                                           |
| STK-2 | Node.js + TypeScript com Express, Fastify ou Koa | ✅     | Fastify 5 ([`backend/src/app.ts`](../backend/src/app.ts))                                                        |
| STK-3 | ORM ou query builder justificado                 | ✅     | Drizzle ([`backend/src/models`](../backend/src/models)); justificativa na tabela "Bibliotecas" do `DECISIONS.md` |
| STK-4 | Bibliotecas adicionais justificadas              | 🔄     | Tabela "Bibliotecas" do `DECISIONS.md`                                                                           |
| QLT-1 | `strict: true`                                   | ✅     | [`tsconfig.base.json`](../tsconfig.base.json)                                                                    |
| QLT-2 | Nenhum `any`                                     | ✅     | `@typescript-eslint/no-explicit-any: error`                                                                      |
| QLT-3 | SOLID, separação de camadas, nomes descritivos   | 🔄     | [ADR 0001](adr/0001-modular-monolith-and-shared-contracts.md); fronteiras verificadas por lint                   |

## 1. Autenticação e autorização

| ID     | Requisito                                                                                             | Status | Onde / teste                                                                                                                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-1 | Perfis `admin` (total) e `viewer` (leitura de pedidos, produtos e relatórios)                         | 🔄     | `authorize(...roles)` em [`middlewares/auth.ts`](../backend/src/middlewares/auth.ts) · [`auth-guards.test.ts`](../backend/tests/auth-guards.test.ts). Aplicado às rotas de escrita junto com elas               |
| AUTH-2 | JWT com access token (15 min) e refresh token (7 dias)                                                | ✅     | [`auth.service.ts`](../backend/src/modules/auth/auth.service.ts) · [`auth.test.ts`](../backend/tests/auth.test.ts); refresh em cookie httpOnly com rotação ([ADR 0004](adr/0004-token-storage-and-rotation.md)) |
| AUTH-3 | bcrypt com no mínimo 10 salt rounds                                                                   | ✅     | Custo 12 em [`seed-official.ts`](../backend/src/db/seed-official.ts) · [`seed.test.ts`](../backend/tests/seed.test.ts)                                                                                          |
| AUTH-4 | 401 para token inválido/expirado (`INVALID_TOKEN` / `TOKEN_EXPIRED`), 403 para permissão insuficiente | ✅     | [`middlewares/auth.ts`](../backend/src/middlewares/auth.ts) · [`auth.test.ts`](../backend/tests/auth.test.ts), [`auth-guards.test.ts`](../backend/tests/auth-guards.test.ts)                                    |
| AUTH-5 | Rate limit de 100 requisições por minuto por IP (429 `RATE_LIMIT_EXCEEDED`)                           | ✅     | [`app.ts`](../backend/src/app.ts) · [`rate-limit.test.ts`](../backend/tests/rate-limit.test.ts); login limitado a 10/min por IP e 10 falhas em 15 min por email                                                 |
| AUTH-6 | Usuários do seed: `admin@fastmeals.com` e `viewer@fastmeals.com`                                      | ✅     | [`seed-official.ts`](../backend/src/db/seed-official.ts) · [`auth.test.ts`](../backend/tests/auth.test.ts)                                                                                                      |
| AUTH-7 | `POST /api/auth/login` e `POST /api/auth/refresh`                                                     | ✅     | [`auth.routes.ts`](../backend/src/modules/auth/auth.routes.ts) · [`auth.test.ts`](../backend/tests/auth.test.ts); mais `logout` e `me` (premissa 11)                                                            |

## 2. Produtos

| ID     | Requisito                                                                                                           | Status | Onde / teste                            |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------- |
| PROD-1 | Campos e validações (nome 3–120, descrição 10–500, preço > 0 com até 2 casas, categoria, URL válida, preparo 1–120) | ⏳     |                                         |
| PROD-2 | CRUD: `GET` lista, `GET /:id`, `POST` (201), `PUT` parcial, `DELETE` (204)                                          | ⏳     |                                         |
| PROD-3 | Não excluir produto em pedido `pending` ou `preparing` (409 `PRODUCT_IN_USE`)                                       | ⏳     |                                         |
| PROD-4 | Produto indisponível fora de listagens públicas, visível no painel                                                  | ⏳     | Premissa 2 do `DECISIONS.md`            |
| PROD-5 | Paginação (`page`, `limit` ≤ 100), busca por nome, filtros de categoria e disponibilidade, ordenação                | ⏳     |                                         |
| PROD-6 | Excluir produto já vendido sem quebrar a FK de `order_items`                                                        | ⏳     | Coluna `deleted_at` criada (premissa 5) |

## 3. Pedidos

| ID    | Requisito                                                                                                                      | Status | Onde / teste                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| ORD-1 | Campos e validações (cliente 3–100, telefone `(XX) XXXXX-XXXX`, endereço 10–300, coordenadas, itens)                           | ⏳     |                                                                                                                                     |
| ORD-2 | `totalAmount` calculado no backend; `unitPrice` como snapshot do preço                                                         | ⏳     |                                                                                                                                     |
| ORD-3 | Não criar pedido com produto indisponível (422 `UNAVAILABLE_PRODUCT` com `details`)                                            | ⏳     |                                                                                                                                     |
| ORD-4 | Somente as 7 transições válidas; qualquer outra retorna 422 `INVALID_STATUS_TRANSITION`                                        | ⏳     |                                                                                                                                     |
| ORD-5 | `ready → delivering` exige entregador atribuído                                                                                | ⏳     |                                                                                                                                     |
| ORD-6 | Listagem com paginação, filtro por status e ordenação por data                                                                 | ⏳     |                                                                                                                                     |
| ORD-7 | Filtro por data na listagem (exigido pela tela 5.2)                                                                            | ⏳     | Premissa 3                                                                                                                          |
| ORD-8 | `PATCH /:id/assign`: entregador existe, está ativo e não está em outro pedido em andamento (422 `DELIVERY_PERSON_UNAVAILABLE`) | ⏳     | Índice único parcial `uq_orders_active_delivery_person` criado ([`0002`](../backend/drizzle/0002_active_delivery_person_index.sql)) |

## 4. Entregadores

| ID    | Requisito                                                                        | Status | Onde / teste                              |
| ----- | -------------------------------------------------------------------------------- | ------ | ----------------------------------------- |
| DRV-1 | Campos e validações (nome 3–100, telefone, veículo, ativo, localização opcional) | ⏳     |                                           |
| DRV-2 | `GET` com filtros `isActive` e `available`; resposta com `currentOrderId`        | ⏳     |                                           |
| DRV-3 | `POST`, `PUT`, `DELETE` (admin)                                                  | ⏳     |                                           |
| DRV-4 | Não excluir entregador com pedido `delivering`                                   | ⏳     | 409 `DELIVERY_PERSON_IN_USE` (premissa 6) |

## 5. Frontend

| ID   | Requisito                                                                                                                                                        | Status | Onde / teste                                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| UI-1 | Login com validação, erros visíveis, redirecionamento e volta ao login quando o token expira                                                                     | ⏳     |                                                                                                                                  |
| UI-2 | Pedidos: paginação, filtros de status e data, cliente/itens/total/status/data, ações contextuais, detalhes, indicador visual por status                          | ⏳     |                                                                                                                                  |
| UI-3 | Produtos: tabela paginada com busca, formulário com validação em tempo real, confirmação de exclusão, toggle de disponibilidade                                  | ⏳     |                                                                                                                                  |
| UI-4 | Relatórios: 4 métricas, filtro de período, pelo menos 2 gráficos                                                                                                 | ⏳     |                                                                                                                                  |
| UI-5 | Atribuição: pedidos `ready`, entregadores disponíveis, botão "Sugerir Atribuição Otimizada", aceitar/rejeitar cada sugestão, pedido aceito vai para `delivering` | ⏳     |                                                                                                                                  |
| UI-6 | Estados de loading, erro e vazio; componentização                                                                                                                | 🔄     | Tokens e primitivos em [`frontend/src/components`](../frontend/src/components) e [`frontend/src/styles`](../frontend/src/styles) |

## 6. Algoritmo de atribuição

| ID    | Requisito                                                                  | Status | Onde / teste      |
| ----- | -------------------------------------------------------------------------- | ------ | ----------------- |
| ALG-1 | Entrada: pedidos `ready` e entregadores ativos sem pedido em andamento     | ⏳     |                   |
| ALG-2 | No máximo 1 pedido por entregador                                          | ⏳     |                   |
| ALG-3 | Distância por Haversine (R = 6371 km)                                      | ⏳     |                   |
| ALG-4 | Minimizar a soma total das distâncias                                      | ⏳     | Algoritmo Húngaro |
| ALG-5 | Pedidos excedentes em `unassigned`; entregadores excedentes sem atribuição | ⏳     |                   |
| ALG-6 | Complexidade razoável (nada de O(n!))                                      | ⏳     |                   |
| ALG-7 | `POST /api/orders/optimize-assignment` com `algorithm` e `executionTimeMs` | ⏳     |                   |
| ALG-8 | Abordagem, complexidade e trade-offs no `DECISIONS.md`                     | ⏳     |                   |
| ALG-9 | Casos-limite: sem entregadores, sem pedidos, empates                       | ⏳     |                   |

## 7. Relatórios

| ID    | Requisito                                                    | Status | Onde / teste                                |
| ----- | ------------------------------------------------------------ | ------ | ------------------------------------------- |
| RPT-1 | Receita por período (pedidos `delivered`) com receita diária | ⏳     |                                             |
| RPT-2 | Pedidos por status                                           | ⏳     | Com filtro de período opcional (premissa 7) |
| RPT-3 | Top 10 produtos por quantidade (só `delivered`)              | ⏳     |                                             |
| RPT-4 | Tempo médio entre criação e entrega, por tipo de veículo     | ⏳     | Tabela `order_status_history` (premissa 8)  |

## Requisitos não funcionais

| ID     | Requisito                                                             | Status | Onde / teste                                                                                                      |
| ------ | --------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| NFR-1  | Validação de body, query e params no backend                          | 🔄     | Zod + `fastify-type-provider-zod`                                                                                 |
| NFR-2  | Formato padrão de erro `{ error: { code, message, details } }`        | ✅     | [`error-handler.ts`](../backend/src/middlewares/error-handler.ts) · [`app.test.ts`](../backend/tests/app.test.ts) |
| NFR-3  | Códigos HTTP semânticos (200, 201, 400, 401, 403, 404, 422, 429, 500) | 🔄     | 400, 401, 403, 404, 429 e 500 já cobertos                                                                         |
| PERF-1 | Listagens < 200 ms com 10.000 registros                               | ⏳     | Massa de teste: `npm run seed:load` (10 mil pedidos)                                                              |
| PERF-2 | Otimização < 2 s com 50 pedidos e 30 entregadores                     | ⏳     |                                                                                                                   |

## Testes

| ID    | Requisito                                                                                                      | Status | Onde                                                                                                                                          |
| ----- | -------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| TST-1 | Backend: no mínimo 10 testes, com 2 de cada: autenticação, CRUD de produtos, transições, algoritmo, relatórios | 🔄     | Autenticação: token válido e inválido em [`auth.test.ts`](../backend/tests/auth.test.ts). Faltam produtos, transições, algoritmo e relatórios |
| TST-2 | Frontend: no mínimo 5 testes, com renderização, interação e integração de tela                                 | ⏳     |                                                                                                                                               |

## Banco de dados

| ID   | Requisito                                                                 | Status | Onde                                                                                                                                                                                   |
| ---- | ------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB-1 | Normalização, tipos corretos, FKs e constraints                           | ✅     | [`backend/src/models`](../backend/src/models) · [`0001_schema.sql`](../backend/drizzle/0001_schema.sql); `CHECK`s gerados dos enums de `contracts`                                     |
| DB-2 | Índices para as consultas frequentes, incluindo compostos para relatórios | ✅     | Índices do schema de referência, GIN `pg_trgm` para a busca, `(to_status, changed_at)` no histórico e índice único parcial de atribuição                                               |
| DB-3 | `updated_at` automático (trigger)                                         | ✅     | [`0003_updated_at_trigger.sql`](../backend/drizzle/0003_updated_at_trigger.sql); inclui `delivery_persons`, que não tem a coluna no schema de referência                               |
| DB-4 | Migrations reproduzíveis                                                  | ✅     | Migrations do `drizzle-kit` em [`backend/drizzle`](../backend/drizzle), aplicadas por [`migrate.ts`](../backend/src/db/migrate.ts) sob advisory lock; o CI aplica tudo num banco vazio |
| DB-5 | Seed lendo `seed/data.json` via `npm run seed` no `backend/`              | ✅     | [`seed.ts`](../backend/src/db/seed.ts) · [`seed.test.ts`](../backend/tests/seed.test.ts); idempotente e determinístico (premissas 4 e 12)                                              |

## Entrega

| ID    | Requisito                                                             | Status | Onde                                                                                            |
| ----- | --------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| DEL-1 | Código completo (backend + frontend)                                  | 🔄     |                                                                                                 |
| DEL-2 | `DECISIONS.md` com bibliotecas, algoritmo, arquitetura e dificuldades | 🔄     | [`DECISIONS.md`](../DECISIONS.md)                                                               |
| DEL-3 | `docker-compose.yml` subindo backend, frontend e banco                | ✅     | [`docker-compose.yml`](../docker-compose.yml); funciona com `docker compose` e `docker-compose` |
| DEL-4 | Instruções no README do backend e do frontend                         | 🔄     | [`backend/README.md`](../backend/README.md) atualizado a cada entrega                           |
| DEL-5 | Backend na porta 3001, frontend na 3000                               | ✅     |                                                                                                 |

## Diferenciais listados nos critérios

| ID     | Bônus                                                   | Status | Onde                                                                                                                 |
| ------ | ------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| BON-1  | WebSockets no painel de pedidos                         | ⏳     |                                                                                                                      |
| BON-2  | Swagger/OpenAPI gerado automaticamente                  | ✅     | `/api/docs`, gerado dos schemas Zod                                                                                  |
| BON-3  | CI com lint e testes                                    | ✅     | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)                                                            |
| BON-4  | Testes E2E (Playwright)                                 | ⏳     |                                                                                                                      |
| BON-5  | Responsividade mobile                                   | ⏳     |                                                                                                                      |
| BON-6  | Dark mode                                               | 🔄     | Tokens dos dois temas prontos                                                                                        |
| BON-7  | Logs estruturados                                       | ✅     | Pino, com `requestId` e redação de credenciais                                                                       |
| BON-8  | `GET /api/health`                                       | ✅     | [`health.routes.ts`](../backend/src/modules/health/health.routes.ts) · [`app.test.ts`](../backend/tests/app.test.ts) |
| BON-9  | Acessibilidade (ARIA, teclado)                          | 🔄     | Primitivos Radix, foco visível, `prefers-reduced-motion`                                                             |
| BON-10 | Animações e transições suaves                           | 🔄     | Tokens de movimento                                                                                                  |
| BON-11 | Cache de listagens com invalidação (Redis ou in-memory) | ⏳     | In-memory, invalidado por `LISTEN/NOTIFY`                                                                            |
| BON-12 | Métricas de tempo de execução do algoritmo              | ⏳     | `executionTimeMs`, log estruturado e header `Server-Timing`                                                          |
