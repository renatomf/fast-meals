# Benchmarks

Números medidos em 24/10/2026, não estimados. O enunciado pede listagens abaixo de 200 ms com até 10.000 registros e a otimização abaixo de 2 s com 50 pedidos e 30 entregadores.

**Máquina:** Intel Core i5-13450HX, 16 GB de RAM, Windows 11. Node 24.22.1. PostgreSQL 18.6 no Docker Desktop (imagem do projeto), com 10.012 pedidos (`npm run seed` + `npm run seed:load`).

## Algoritmo de atribuição

`npm run bench:assignment`. Distâncias por Haversine, semente fixa, dois aquecimentos antes das medições, só o tempo do algoritmo sobre a matriz pronta. Duas geometrias:

- **espalhada:** pontos aleatórios numa área de cerca de 20 × 20 km em São Paulo, o caso comum;
- **em fila:** pedidos numa linha norte–sul e entregadores numa leste–oeste, a cada ~11 m. Custos tão regulares obrigam o Húngaro a percorrer caminhos aumentantes longos. É o pior caso que encontrei.

| Geometria | Pedidos × entregadores | Húngaro (mediana / p95) | Guloso (mediana) | Distância a mais do guloso |
| --------- | ---------------------- | ----------------------- | ---------------- | -------------------------- |
| espalhada | 50 × 30                | 0,07 ms / 0,23 ms       | 0,28 ms          | +4,4%                      |
| espalhada | 200 × 200              | 3,97 ms / 6,05 ms       | 10,16 ms         | +32,7%                     |
| espalhada | 500 × 500              | 28,96 ms / 29,59 ms     | 76,30 ms         | +31,3%                     |
| em fila   | 50 × 30                | 0,15 ms / 0,17 ms       | 0,20 ms          | +0,0%                      |
| em fila   | 200 × 200              | 17,14 ms / 18,83 ms     | 5,86 ms          | +0,0%                      |
| em fila   | 500 × 500              | 251,82 ms / 255,40 ms   | 39,15 ms         | +0,0%                      |

- O caso do enunciado (50 × 30) leva menos de 0,3 ms nas duas geometrias, contra o limite de 2 s.
- Na geometria espalhada, a realista, o Húngaro é mais rápido que o guloso e o guloso roda até um terço a mais. Na geometria em fila, o guloso acerta o ótimo e é mais rápido: os custos regulares que travam o Húngaro são justamente os que facilitam a escolha gulosa.
- A primeira versão deste benchmark só tinha a geometria espalhada e mostrava 28 ms para 500 × 500. Foi um teste do limite de lote, com pontos em fila, que revelou o pior caso, quase dez vezes mais lento.
- No endpoint, com o seed oficial, o Húngaro percorre 6,17 km contra 7,32 km do guloso (15,7% a menos). Com o cenário de demonstração, 21,56 km contra 38,11 km (43,4% a menos).

### Limite de lote

O algoritmo roda no processo da API, e o Node atende uma requisição por vez enquanto ele calcula. Medi o Húngaro fora do endpoint em matrizes maiores: 108 ms para 1.000 × 1.000 aleatória e 717 ms para 2.000 × 2.000. Por isso o endpoint otimiza no máximo os **500 pedidos prontos mais antigos**; os demais voltam como `unassigned` com o motivo "Waiting for the next optimization batch", e o log registra um aviso. Mesmo no pior caso medido, 500 pedidos ficam em cerca de 250 ms.

## Listagens e relatórios

`npm run bench:listings`. 50 requisições por rota depois de 5 de aquecimento, via `app.inject`: mede roteamento, autenticação, validação, consulta e serialização, sem a rede.

| Rota                                               | Mediana | p95     | Máximo  |
| -------------------------------------------------- | ------- | ------- | ------- |
| `GET /api/orders?limit=20`                         | 3,3 ms  | 5,7 ms  | 7,2 ms  |
| `GET /api/orders?limit=100`                        | 5,5 ms  | 6,4 ms  | 7,7 ms  |
| `GET /api/orders?status=delivered&limit=20`        | 3,3 ms  | 4,7 ms  | 7,2 ms  |
| `GET /api/orders` com 90 dias, ordenado por total  | 7,6 ms  | 9,4 ms  | 11,0 ms |
| `GET /api/orders?page=450&limit=20` (fim da lista) | 9,6 ms  | 10,5 ms | 10,7 ms |
| `GET /api/products?search=burg`                    | 1,3 ms  | 1,7 ms  | 1,9 ms  |
| `GET /api/delivery-persons?available=true`         | 1,6 ms  | 1,9 ms  | 2,1 ms  |
| `GET /api/reports/revenue` com 90 dias             | 7,8 ms  | 8,6 ms  | 9,7 ms  |
| `GET /api/reports/orders-by-status`                | 1,5 ms  | 2,1 ms  | 2,2 ms  |
| `GET /api/reports/top-products`                    | 9,7 ms  | 11,3 ms | 12,4 ms |
| `GET /api/reports/average-delivery-time`           | 8,6 ms  | 9,5 ms  | 9,5 ms  |

O pior caso medido, 12,4 ms, fica mais de 15 vezes abaixo dos 200 ms. Pela nginx do Docker, com rede, as listagens ficaram entre 7 e 53 ms numa medição informal com `curl`.

## O que o EXPLAIN ANALYZE mostrou

O primeiro `EXPLAIN ANALYZE` da listagem padrão (`ORDER BY created_at DESC, id ... LIMIT 20`) mostrou leitura sequencial da tabela inteira seguida de ordenação, mesmo com o índice `idx_orders_created_at` criado. Eram dois problemas:

1. O `drizzle-kit` gera `.desc()` como `DESC NULLS LAST`. Um `ORDER BY created_at DESC` comum significa `DESC NULLS FIRST`, e o planejador não usa um índice com outra ordem de nulos, nem com leituras sequenciais desligadas. O índice de referência nunca foi usado desde que foi criado.
2. O desempate por `id` era sempre crescente, misturando direções.

Com os índices de `created_at` trocados por `(created_at, id)` ascendente, que o PostgreSQL lê de trás para frente, e o desempate seguindo a direção da ordenação:

| Consulta                                | Antes                                              | Depois                                 |
| --------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| Primeira página, mais recentes primeiro | Seq Scan + top-N sort, 1,6 ms                      | Index Scan Backward, 0,1 ms            |
| Filtro por status                       | Index Scan em `idx_orders_status_created`, 0,08 ms | igual                                  |
| Contagem por status                     | Index Only Scan em `idx_orders_status`, 0,8 ms     | igual                                  |
| Ordenação por total, 90 dias            | Seq Scan + top-N sort, 3,3 ms                      | igual: não há índice em `total_amount` |

Ficaram de fora, conscientemente:

- **Ordenação por total.** É rara no painel e custa 3 ms com 10 mil pedidos. Um índice em `total_amount` só se pagaria com volume muito maior.
- **Paginação profunda.** Com offset de 9.000, o PostgreSQL prefere ler a tabela a percorrer o índice, e está certo para esse tamanho. Em escala, a saída seria paginação por cursor (`created_at, id` da última linha), registrada no ADR 0006.
