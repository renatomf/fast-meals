# ADR 0006 — Caminho para escalar além de uma instância

- **Status:** proposto (nada disto está implementado; é o plano para quando for preciso)
- **Data:** 25/10/2026

## Contexto

A entrega roda uma instância da API, um PostgreSQL e uma nginx, e cumpre as metas do enunciado com folga: listagens com 10 mil pedidos em até 12,4 ms (meta: 200 ms) e otimização 50 × 30 em menos de 0,3 ms (meta: 2 s) ([`docs/benchmarks.md`](../benchmarks.md)). Fazer mais que isso agora seria complexidade sem uso.

Algumas decisões, porém, valem "por instância", e o código e os outros ADRs apontam para cá quando dizem isso. Este registro junta esses pontos: o que acontece com várias réplicas da API atrás de um balanceador, o que muda e qual sinal indica a hora de mudar.

## O que já funciona com várias instâncias

- **Autenticação.** O access token é um JWT validado só com o segredo; qualquer instância aceita. O refresh token e a detecção de reuso ficam no banco, com lock (ADR 0004), então a rotação continua correta mesmo com duas instâncias recebendo o mesmo token ao mesmo tempo.
- **Regras de integridade.** "Um pedido ativo por entregador", transições de status e o 409 de produto em uso são garantidos pelo PostgreSQL: índice único parcial, `UPDATE ... WHERE status = :de` e `FOR SHARE` (ADR 0003). Não dependem de qual instância atendeu.
- **Tempo real e cache de relatórios.** Cada instância escuta o mesmo canal `LISTEN` e repassa aos próprios clientes WebSocket; o mesmo aviso limpa o cache de relatórios de cada uma (ADR 0005). Não há sessão grudada (_sticky session_): qualquer instância entrega todos os avisos.

## O que muda, e quando

| Ponto                       | Hoje                                                                                                     | Com várias instâncias                                                                                                      | Sinal para mudar                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Rate limit por IP           | Contador em memória: o limite vale por instância, então N réplicas aceitam N × 100 req/min do mesmo IP   | Store no Redis (`@fastify/rate-limit` já aceita), contador único                                                           | Segunda réplica no ar                                                           |
| Bloqueio de login por email | Contador em memória, zera quando a API reinicia (ADR 0004)                                               | Redis com `INCR` e expiração da janela: o bloqueio vale entre réplicas e sobrevive a um deploy                             | Segunda réplica no ar                                                           |
| Otimização de atribuição    | Roda no processo da API e o bloqueia: no máximo 500 pedidos por chamada, ~250 ms no pior caso (ADR 0002) | Uma _worker thread_ (ou um serviço à parte) com o mesmo código, e a rota só espera o resultado                             | Lote maior que 500, ou p99 das outras rotas subindo durante otimizações         |
| Conexões com o banco        | Pool de 10 por instância, mais 1 para o `LISTEN`                                                         | PgBouncer em modo transação na frente do PostgreSQL. O `LISTEN` precisa de conexão direta, fora do PgBouncer               | `max_connections` perto do limite com N × 11 conexões                           |
| Paginação profunda          | `OFFSET`: na página 450 de 20, o PostgreSQL lê e descarta 9 mil linhas                                   | Paginação por cursor (`created_at, id` da última linha); os índices `(created_at, id)` já existem para isso                | Listagens com centenas de milhares de pedidos, ou páginas profundas em uso real |
| Relatórios                  | Agregações no banco principal, com cache em memória                                                      | Réplica de leitura para relatórios; com volume muito maior, tabela de resumo diária atualizada pelo mesmo aviso de mudança | Relatórios competindo com a operação por CPU do banco                           |
| Trigger de aviso            | Um `NOTIFY` por linha alterada                                                                           | Trigger por comando (`FOR EACH STATEMENT`) avisando só a entidade, para atualizações em massa                              | Importações ou atualizações em lote frequentes                                  |
| Tokens de refresh           | O login apaga os vencidos do próprio usuário                                                             | Job periódico de limpeza geral                                                                                             | Tabela `refresh_tokens` crescendo sem parar                                     |

## Alternativas consideradas

| Alternativa                               | Por que não agora                                                                                                                                                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Já entregar com Redis                     | Mais um serviço no compose para um problema que só existe com a segunda réplica. O enunciado pede um comando para subir tudo, e cada serviço a mais é mais um ponto de falha na avaliação                                         |
| Fila (BullMQ, RabbitMQ) para a otimização | O cálculo leva milissegundos e o operador espera o resultado na tela; uma fila só se pagaria com lotes muito maiores ou com otimização automática em segundo plano                                                                |
| Microsserviços por módulo                 | Os módulos já têm fronteiras verificadas por lint (ADR 0001). Separar em serviços traria rede e consistência distribuída sem ganho para este volume; as fronteiras permitem extrair um módulo depois, se um deles crescer sozinho |

## Consequências

- O que está em memória é aceito conscientemente e documentado no próprio código, com referência a este registro.
- A ordem provável é: Redis para os dois contadores ao subir a segunda réplica, PgBouncer quando as conexões apertarem, e o resto só com volume medido. Nenhum item muda contrato de API: o front não percebe a troca.
