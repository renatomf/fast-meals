# ADR 0002 — Algoritmo Húngaro para a atribuição de entregadores

- **Status:** aceito
- **Data:** 24/10/2026

## Contexto

A tela de despacho precisa sugerir qual entregador leva cada pedido pronto. O enunciado fixa as regras: no máximo um pedido por entregador, distância por Haversine, minimizar a soma das distâncias, sobras de qualquer lado ficam sem par, e força bruta O(n!) não é aceita acima de 6 elementos.

É o problema de atribuição clássico, numa matriz de custo retangular: n pedidos × m entregadores, com custo igual à distância entre o entregador e o endereço de entrega.

## Decisão

**Algoritmo Húngaro com potenciais** (Kuhn–Munkres, na variante e-maxx, uma forma simplificada de Jonker–Volgenant), em [`hungarian.ts`](../../backend/src/algorithms/hungarian.ts):

- Cada linha (pedido) entra uma vez. Para cada uma, uma busca no estilo Dijkstra sobre os custos reduzidos `a[i][j] − u[i] − v[j]` encontra o caminho aumentante mais barato até uma coluna livre, em O(n·m). Total: **O(n²·m)** em tempo e O(n + m) em memória extra, além da matriz.
- Os potenciais `u` e `v` mantêm os custos reduzidos nunca negativos, e toda atribuição feita tem custo reduzido zero. Isso é o que garante o ótimo.
- A variante pressupõe n ≤ m. Com mais pedidos que entregadores, resolvo a transposta (cada entregador escolhe um pedido) e inverto; os pedidos não escolhidos voltam como `unassigned`.
- Empates vão para a coluna de menor índice, e as entradas chegam em ordem estável (criação, depois id). A mesma situação gera sempre a mesma sugestão.

**Entrada do endpoint:** pedidos `ready` ainda sem entregador, e entregadores ativos, sem pedido `ready` ou `delivering` e com localização. Quem não tem coordenadas fica de fora: não há distância para calcular.

**O endpoint só sugere.** Aceitar é usar as rotas que já existem (`PATCH /orders/:id/assign` e depois `PATCH /orders/:id/status`), que passam pelo índice único parcial ([ADR 0003](0003-database-integrity-and-concurrency.md)). Se dois operadores aceitarem sugestões conflitantes, o banco recusa a segunda.

**Guloso como referência.** O endpoint devolve também o total de um guloso (sempre o par mais barato que sobrou), para o painel mostrar quanto o ótimo economiza.

## Como validei

Escrevi os testes antes da implementação, e o histórico de commits mostra essa ordem:

- **Oráculo de força bruta:** em 500 matrizes aleatórias de até 6 × 7 e 7 × 6, o total do Húngaro é igual ao mínimo encontrado testando todas as atribuições.
- **Propriedades:** o Húngaro nunca perde do guloso; cada entregador recebe no máximo um pedido; o número de atribuições é sempre min(n, m); a mesma entrada dá a mesma saída.
- **Contraexemplo do guloso:** na matriz `[[1, 2], [2, 100]]`, o guloso pega o 1 e fica preso ao 100 (101), enquanto o ótimo cruza (4).
- **Sabotagem:** trocar o sinal dos potenciais, pular a atualização de `minReduced`, não refazer o caminho aumentante ou não inverter a transposta derruba os testes.

Os números de desempenho estão em [`docs/benchmarks.md`](../benchmarks.md): 0,06 ms para 50 × 30 e 28 ms para 500 × 500.

## Alternativas consideradas

| Alternativa                                             | Por que não                                                                                                                                                                                              |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Força bruta                                             | O(n!), proibida pelo enunciado; serve só como oráculo nos testes                                                                                                                                         |
| Guloso (par mais próximo primeiro)                      | Rápido, mas não é ótimo: rodou 31% a mais em 500 × 500 e 43% a mais no cenário de demonstração. Ficou como referência de comparação                                                                      |
| Fluxo de custo mínimo                                   | Chega ao mesmo ótimo, com mais código e uma estrutura de grafo que este problema não precisa                                                                                                             |
| LAPJV completo                                          | Mais rápido na prática em matrizes grandes, mas com inicialização e etapas extras que eu teria mais dificuldade de explicar linha a linha. Com 28 ms em 500 × 500, o ganho não muda nada para o operador |
| Algoritmo de leilão                                     | Paralelizável, mas o resultado depende de um ε e pode ficar a ε do ótimo                                                                                                                                 |
| Biblioteca de otimização (solver de programação linear) | Uma dependência pesada para um problema que tem algoritmo exato com cem linhas                                                                                                                           |
| Distância por ruas (OSRM, Google Maps)                  | Mais realista, mas exige serviço externo e chave. Haversine é o que o enunciado pede                                                                                                                     |

## Consequências

- A distância é em linha reta. Com rios, viadutos e ruas de mão única, a ordem real pode ser outra. Para trocar por distância de ruas, basta mudar quem preenche a matriz; o algoritmo não muda.
- Um entregador leva um pedido por vez. Agrupar pedidos próximos numa mesma rota é outro problema (roteamento de veículos), fora do escopo.
- A sugestão é recalculada inteira a cada chamada. Com O(n²·m) isso é instantâneo para a escala de um restaurante; uma operação com milhares de pedidos simultâneos dividiria a cidade em regiões antes de otimizar.
- `executionTimeMs` cobre montar e resolver a matriz, sem as consultas ao banco, para o número refletir o algoritmo. O mesmo tempo vai para o header `Server-Timing` e para o log.
