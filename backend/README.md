# FastMeals — Backend

API REST em Fastify 5 e TypeScript. Roda direto no Node 24, que executa TypeScript sem etapa de build (type stripping).

## Requisitos

- Node.js 24.22.1+ (linha 24; veja `../.nvmrc`)
- PostgreSQL acessível pela `DATABASE_URL`

## Configuração

As variáveis ficam no `.env` da raiz do repositório:

```bash
cp ../.env.example ../.env
```

| Variável       | Padrão                  | Descrição                             |
| -------------- | ----------------------- | ------------------------------------- |
| `DATABASE_URL` | — (obrigatória)         | Connection string do PostgreSQL       |
| `PORT`         | `3001`                  | Porta HTTP                            |
| `HOST`         | `0.0.0.0`               | Interface de escuta                   |
| `NODE_ENV`     | `development`           | `development`, `test` ou `production` |
| `LOG_LEVEL`    | `info`                  | Nível do log Pino                     |
| `CORS_ORIGIN`  | `http://localhost:3000` | Origem autorizada no CORS             |

Uma variável ausente ou inválida impede o servidor de subir e a mensagem diz qual é.

## Comandos

```bash
npm install
npm run dev        # http://localhost:3001, reinicia ao salvar
npm start          # sem watch
npm test
npm run typecheck
```

## Endpoints disponíveis

| Rota              | Descrição                                   |
| ----------------- | ------------------------------------------- |
| `GET /api/health` | Status da API e do banco (200 ou 503)       |
| `GET /api/docs`   | Swagger UI, gerado a partir dos schemas Zod |

## Organização

```
src/
├── server.ts        bootstrap e graceful shutdown
├── app.ts           montagem da aplicação (composition root)
├── config/          validação do ambiente
├── db/              conexão com o PostgreSQL
├── shared/errors/   erros de domínio e formato padrão de resposta
└── modules/         um módulo por domínio (routes → service → repository)
```

As fronteiras entre camadas são verificadas pelo ESLint: uma rota não acessa o banco diretamente e um algoritmo não importa Fastify, por exemplo.
