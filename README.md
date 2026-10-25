# FastMeals

[![CI](https://github.com/renatomf/fast-meals/actions/workflows/ci.yml/badge.svg)](https://github.com/renatomf/fast-meals/actions/workflows/ci.yml)

Painel administrativo de uma plataforma de delivery: cardápio, pedidos, entregadores, relatórios e atribuição otimizada de entregas. Solução do [desafio técnico](docs/challenge.md) para Engenheiro de Software Sênior.

![Despacho: o algoritmo Húngaro sugere as atribuições, compara com o guloso e mostra a matriz de distâncias](docs/images/dispatch.gif)

## Avalie em 5 minutos

1. **Suba tudo:** `docker compose up --build` (ou `docker-compose up --build`). Migrations e seed rodam sozinhos.
2. **Entre** em http://localhost:3000 com o botão "Entrar como admin".
3. **Veja o algoritmo:** em **Despacho**, clique em "Cenário de demonstração" e depois em "Sugerir Atribuição Otimizada". O card compara o Húngaro com o guloso (mandar cada pedido ao entregador mais próximo), o mapa mostra as rotas e "Ver matriz de distâncias" mostra por que o ótimo às vezes ignora o par mais próximo. Aceite uma sugestão: o pedido vai para "Em entrega".
4. **Veja o resto:** pedidos com filtros e ações por status, cardápio, entregadores e relatórios. `Ctrl+K` abre a busca de qualquer tela; o tema escuro fica no cabeçalho.
5. **Entre como viewer** (`viewer@fastmeals.com` / `Viewer@123`): tudo aparece, as ações ficam desabilitadas com o motivo.

Opcional:

- **Volume para os relatórios:** `docker compose exec backend node src/db/seed-load.ts` cria 10 mil pedidos encerrados nos últimos 90 dias.
- **Painel ao vivo:** `npm install && npm run simulate` na raiz faz o restaurante funcionar pela API; as telas abertas atualizam sozinhas.
- **API:** Swagger em http://localhost:3001/api/docs.

### O que olhar no código

| Para avaliar | Comece por                                                                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Algoritmo    | [`hungarian.ts`](backend/src/algorithms/hungarian.ts), [`haversine.ts`](backend/src/algorithms/haversine.ts), [ADR 0002](docs/adr/0002-hungarian-assignment.md) e [`assignment.test.ts`](backend/tests/assignment.test.ts) (Húngaro contra força bruta) |
| Requisitos   | [`docs/requirements-traceability.md`](docs/requirements-traceability.md): onde cada requisito está e como é testado                                                                                                                                     |
| Decisões     | [`DECISIONS.md`](DECISIONS.md) e os [ADRs](docs/adr/)                                                                                                                                                                                                   |
| Desempenho   | [`docs/benchmarks.md`](docs/benchmarks.md)                                                                                                                                                                                                              |

## Rodando com Docker

Requer Docker com Compose v2. Os dois comandos funcionam (o segundo é o do enunciado):

```bash
docker compose up --build
docker-compose up --build
```

| Serviço                       | Endereço                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Painel                        | http://localhost:3000                                                             |
| API                           | http://localhost:3001/api                                                         |
| Documentação da API (Swagger) | http://localhost:3001/api/docs                                                    |
| Health check                  | http://localhost:3001/api/health                                                  |
| PostgreSQL                    | `localhost:5433` (só na máquina local; usuário `fastmeals`, senha `fastmeals123`) |

O banco fica na porta 5433 do host para não colidir com um PostgreSQL local na 5432. O backend aplica as migrations e popula o banco ao subir; reiniciar os containers não apaga dados.

### Credenciais

| Perfil              | Email                  | Senha        |
| ------------------- | ---------------------- | ------------ |
| Admin (tudo)        | `admin@fastmeals.com`  | `Admin@123`  |
| Viewer (só leitura) | `viewer@fastmeals.com` | `Viewer@123` |

## Rodando sem Docker

Requer Node.js 24.22.1 ou superior na linha 24 (veja `.nvmrc`) e um PostgreSQL acessível.

```bash
cp .env.example .env   # ajuste DATABASE_URL para o seu PostgreSQL
                       # (ou use o do Docker: docker compose up -d db, porta 5433)

# Terminal 1
cd backend
npm install
npm run seed           # migrations + dados de seed/data.json
npm run dev            # http://localhost:3001

# Terminal 2
cd frontend
npm install
npm run dev            # http://localhost:3000
```

O botão "Cenário de demonstração" do despacho só funciona com `DEMO_MODE=true` no `.env` (no Docker ele já vem ligado). O volume de 10 mil pedidos para os relatórios sai com `npm run seed:load` em `backend/`.

Instruções específicas em [`backend/README.md`](backend/README.md) e [`frontend/README.md`](frontend/README.md).

## Estrutura

```
backend/             API Fastify (Node 24 executa o TypeScript direto, sem build)
frontend/            Painel React + Vite + Tailwind + shadcn/ui
packages/contracts/  Schemas Zod e tipos compartilhados entre front e back
docker/postgres/     Imagem endurecida do PostgreSQL
e2e/                 Testes Playwright e de acessibilidade (axe)
docs/                Enunciado, especificação, ADRs e rastreabilidade
seed/data.json       Dados oficiais do desafio
```

## Qualidade

```bash
npm run lint         # inclui as regras de fronteira entre camadas
npm run typecheck
npm test             # o backend precisa do PostgreSQL: docker compose up -d db
npm run build
npm run test:e2e     # Playwright contra o Docker: docker compose up --build antes
```

Na primeira vez, o E2E precisa do navegador: `npx playwright install chromium` dentro de `e2e/`.

O E2E faz mais de 100 requisições por minuto, o limite geral por IP da API. Para rodá-lo, suba o ambiente com um limite maior (os limites de login não mudam):

```bash
RATE_LIMIT_MAX=1000 docker compose up --build -d          # bash
$env:RATE_LIMIT_MAX=1000; docker compose up --build -d     # PowerShell
```

O CI roda tudo isso, verifica que não há JavaScript no repositório, audita dependências e imagens Docker e sobe a stack completa com o mesmo comando acima para rodar o E2E.

## Documentação

- [`DECISIONS.md`](DECISIONS.md): escolhas técnicas, premissas, segurança e dificuldades
- [`docs/adr/`](docs/adr/): registros de decisões de arquitetura
- [`docs/requirements-traceability.md`](docs/requirements-traceability.md): onde cada requisito está atendido e testado
