# FastMeals

Painel administrativo de uma plataforma de delivery: cardápio, pedidos, entregadores, relatórios e atribuição otimizada de entregas. Solução do [desafio técnico](docs/challenge.md) para Engenheiro de Software Sênior.

> Projeto em desenvolvimento. A [matriz de rastreabilidade](docs/requirements-traceability.md) mostra o que já foi entregue, requisito por requisito.

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

O banco fica na porta 5433 do host para não colidir com um PostgreSQL local na 5432.

## Rodando sem Docker

Requer Node.js 24.22.1 ou superior na linha 24 (veja `.nvmrc`) e um PostgreSQL acessível.

```bash
cp .env.example .env   # ajuste DATABASE_URL para o seu PostgreSQL

# Terminal 1
cd backend
npm install
npm run dev            # http://localhost:3001

# Terminal 2
cd frontend
npm install
npm run dev            # http://localhost:3000
```

Instruções específicas em [`backend/README.md`](backend/README.md) e [`frontend/README.md`](frontend/README.md).

## Estrutura

```
backend/             API Fastify (Node 24 executa o TypeScript direto, sem build)
frontend/            Painel React + Vite + Tailwind + shadcn/ui
packages/contracts/  Schemas Zod e tipos compartilhados entre front e back
docker/postgres/     Imagem endurecida do PostgreSQL
docs/                Enunciado, especificação, ADRs e rastreabilidade
seed/data.json       Dados oficiais do desafio
```

## Qualidade

```bash
npm run lint         # inclui as regras de fronteira entre camadas
npm run typecheck
npm test
npm run build
```

O CI roda tudo isso, verifica que não há JavaScript no repositório, audita dependências e imagens Docker e sobe a stack completa com o mesmo comando acima.

## Documentação

- [`DECISIONS.md`](DECISIONS.md): escolhas técnicas, premissas, segurança e dificuldades
- [`docs/adr/`](docs/adr/): registros de decisões de arquitetura
- [`docs/requirements-traceability.md`](docs/requirements-traceability.md): onde cada requisito está atendido e testado
