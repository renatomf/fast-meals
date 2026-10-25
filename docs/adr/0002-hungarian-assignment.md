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

**Entrada validada e sem laço infinito.** O algoritmo recusa matriz irregular ou com custo não finito (`RangeError`) antes de começar. Sem isso, uma matriz com `Infinity` deixava o Húngaro girando para sempre, e uma linha curta virava custo zero sem aviso. Dentro do laço, se nenhuma coluna livre for alcançável, ele lança erro em vez de repetir: com a entrada validada isso não acontece, mas um bug futuro vira erro visível e não um processo travado.

**Lote de no máximo 500 pedidos**, os mais antigos primeiro. O cálculo bloqueia o processo da API enquanto roda; 500 pedidos no pior caso medido levam cerca de 250 ms ([benchmarks](../benchmarks.md)). Os demais voltam como `unassigned`, com motivo próprio, para a próxima otimização.

**Guloso como referência.** O endpoint devolve também o total de um guloso (sempre o par mais barato que sobrou), para o painel mostrar quanto o ótimo economiza.

## Como validei

Escrevi os testes antes da implementação, e o histórico de commits mostra essa ordem:

- **Oráculo de força bruta:** em 500 matrizes aleatórias de até 6 × 7 e 7 × 6, o total do Húngaro é igual ao mínimo encontrado testando todas as atribuições.
- **Propriedades:** o Húngaro nunca perde do guloso; cada entregador recebe no máximo um pedido; o número de atribuições é sempre min(n, m); a mesma entrada dá a mesma saída.
- **Contraexemplo do guloso:** na matriz `[[1, 2], [2, 100]]`, o guloso pega o 1 e fica preso ao 100 (101), enquanto o ótimo cruza (4).
- **Sabotagem:** trocar o sinal dos potenciais, pular a atualização de `minReduced`, não refazer o caminho aumentante ou não inverter a transposta derruba os testes.
- **Testes de mutação (Stryker):** 91% das 201 mutações do algoritmo e da máquina de estados são pegas pelos testes; Haversine e máquina de estados, 100%. A primeira rodada achou duas lacunas reais, já cobertas: o desempate pela coluna de menor índice (o teste só conferia determinismo, não qual coluna ficava) e as mensagens de erro da validação. As 15 que sobrevivem são equivalentes, conferidas uma a uma: guardas que a validação de entrada torna inalcançáveis, atalhos de desempenho (retorno antecipado, `break` do guloso), um valor inicial sempre sobrescrito, a transposta usada também em matriz quadrada e o desempate do guloso, que a ordenação estável do JavaScript já garante. Para rodar: `npm run test:mutation --workspace backend` (relatório em `backend/reports/mutation/`).

Os números de desempenho estão em [`docs/benchmarks.md`](../benchmarks.md): menos de 0,3 ms para 50 × 30; 29 ms para 500 × 500 com pontos espalhados e 252 ms no pior caso, com pontos em fila.

## Alternativas consideradas

| Alternativa                                             | Por que não                                                                                                                                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Força bruta                                             | O(n!), proibida pelo enunciado; serve só como oráculo nos testes                                                                                                                                                    |
| Guloso (par mais próximo primeiro)                      | Rápido, mas não é ótimo: rodou 31% a mais em 500 × 500 e 43% a mais no cenário de demonstração. Ficou como referência de comparação                                                                                 |
| Fluxo de custo mínimo                                   | Chega ao mesmo ótimo, com mais código e uma estrutura de grafo que este problema não precisa                                                                                                                        |
| LAPJV completo                                          | Mais rápido na prática em matrizes grandes, mas com inicialização e etapas extras que eu teria mais dificuldade de explicar linha a linha. Com o lote limitado a 500 pedidos, o ganho não muda nada para o operador |
| Rodar o cálculo numa _worker thread_                    | Tira o cálculo do processo principal, mas com o lote limitado o bloqueio máximo fica em ~250 ms. Vale a troca se o lote crescer ([ADR 0006](0006-scaling-path.md))                                                  |
| Algoritmo de leilão                                     | Paralelizável, mas o resultado depende de um ε e pode ficar a ε do ótimo                                                                                                                                            |
| Biblioteca de otimização (solver de programação linear) | Uma dependência pesada para um problema que tem algoritmo exato com cem linhas                                                                                                                                      |
| Distância por ruas (OSRM, Google Maps)                  | Mais realista, mas exige serviço externo e chave. Haversine é o que o enunciado pede                                                                                                                                |

## Consequências

- A distância é em linha reta. Com rios, viadutos e ruas de mão única, a ordem real pode ser outra. Para trocar por distância de ruas, basta mudar quem preenche a matriz; o algoritmo não muda.
- Um entregador leva um pedido por vez. Agrupar pedidos próximos numa mesma rota é outro problema (roteamento de veículos), fora do escopo.
- A sugestão é recalculada inteira a cada chamada. Com O(n²·m) isso é instantâneo para a escala de um restaurante. Acima de 500 pedidos prontos, os mais novos esperam a próxima otimização; uma operação com milhares de pedidos simultâneos dividiria a cidade em regiões e calcularia fora do processo da API.
- `executionTimeMs` cobre montar e resolver a matriz, sem as consultas ao banco, para o número refletir o algoritmo. O mesmo tempo vai para o header `Server-Timing` e para o log.
