# ADR 0003 — Integridade e concorrência garantidas pelo banco

- **Status:** aceito
- **Data:** 24/10/2026

## Contexto

O painel é usado por vários operadores ao mesmo tempo, e a tela de despacho aceita várias sugestões de uma vez. As regras que mais importam são justamente as que duas requisições simultâneas podem quebrar:

- um entregador não pode ter dois pedidos em andamento;
- um pedido só muda de status pelas transições permitidas, e cada mudança fica registrada;
- um produto em pedido `pending` ou `preparing` não pode ser excluído, e um pedido novo não pode usar um produto excluído.

A forma mais natural de escrever essas regras é consultar e depois agir: "o entregador está livre? então atribua". Entre a consulta e a escrita, outra requisição pode fazer a mesma consulta e receber a mesma resposta. Com uma instância da API, isso já acontece; com várias, nenhuma trava em memória resolveria.

## Decisão

Cada regra é garantida no lugar em que a corrida não existe: o PostgreSQL.

**Um pedido ativo por entregador: índice único parcial.**

```sql
CREATE UNIQUE INDEX uq_orders_active_delivery_person ON orders (delivery_person_id)
  WHERE status IN ('ready', 'delivering') AND delivery_person_id IS NOT NULL;
```

A atribuição não consulta se o entregador está livre: ela tenta gravar, e o índice recusa a segunda. O service reconhece a violação pelo nome da constraint e responde `422 DELIVERY_PERSON_UNAVAILABLE`. Só pedidos `ready` aceitam atribuição; em `preparing` o índice não valeria e o entregador poderia acumular pedidos.

**Transição de status: escrita condicional.** O status é lido, validado pela máquina de estados (código puro, sem banco) e gravado com `UPDATE orders SET status = :to WHERE id = :id AND status = :from`. Se outra requisição mudou o pedido no meio, nenhuma linha é afetada e a resposta é `409 ORDER_CONFLICT`. O registro em `order_status_history` acontece na mesma transação: não existe mudança de status sem histórico.

**Exclusão contra uso: travas de linha.** A exclusão (lógica) de produto ou entregador marca a linha primeiro, o que a trava, e só então confere se ela está em uso; se estiver, o erro desfaz a marcação. Do outro lado, a criação de pedido lê os produtos com `FOR SHARE` e a atribuição lê o entregador com `FOR SHARE`. Quem chegar depois espera a outra transação terminar e enxerga o resultado dela. Os dois lados podem vencer, mas nunca os dois juntos.

**Restrições de valor: `CHECK`.** Status, categoria, veículo e perfil têm `CHECK` geradas a partir das listas do pacote `contracts`, as mesmas que validam a API. Preço e total são `DECIMAL(10,2)` com `CHECK (> 0)`, e a soma do total é feita em centavos inteiros.

### Como sei que funciona

Cada mecanismo tem um teste de concorrência que dispara as requisições ao mesmo tempo, com as conexões do pool já abertas, e cada teste falha quando a proteção é removida:

| Teste                                                               | Sem a proteção                                                                                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 20 atribuições simultâneas do mesmo entregador a pedidos diferentes | Sem a tradução da violação, as perdedoras viram `500`                                                |
| 20 transições idênticas simultâneas do mesmo pedido                 | Sem o `WHERE status = :from`, várias passam e o histórico registra a mesma transição mais de uma vez |
| Exclusão de produto disputando com 10 criações de pedido            | Sem o `FOR SHARE`, a exclusão e as criações são aceitas juntas                                       |
| Exclusão de entregador disputando com 5 atribuições                 | Sem o `FOR SHARE`, o entregador excluído fica com um pedido ativo                                    |

## Alternativas consideradas

| Alternativa                             | Por que não                                                                                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consultar e depois gravar, no código    | É exatamente a corrida descrita acima                                                                                                                                                                             |
| Isolamento `SERIALIZABLE` em tudo       | Resolve, mas toda transação precisaria de lógica de nova tentativa, e os erros de serialização não dizem qual regra foi violada. O índice parcial devolve uma resposta específica (`DELIVERY_PERSON_UNAVAILABLE`) |
| `SELECT ... FOR UPDATE` em toda leitura | Trava mais que o necessário. A transição de status não precisa de trava: a escrita condicional basta e não bloqueia leitores                                                                                      |
| Trava em memória ou fila na API         | Só funciona com uma instância; com duas, volta a corrida                                                                                                                                                          |
| Advisory locks por entregador           | Funcionaria, mas depende de todo código que grava lembrar de pegar a trava. O índice vale para qualquer escrita, inclusive um `UPDATE` manual no `psql`                                                           |

## Consequências

- O front precisa tratar `409 ORDER_CONFLICT`: recarregar o pedido e mostrar o estado atual, em vez de tratar como erro inesperado.
- A regra "um pedido ativo por entregador" mora no schema. Mudá-la (permitir dois pedidos por moto, por exemplo) é uma migration, não uma linha de código.
- O service conhece o nome da constraint (`uq_orders_active_delivery_person`) para traduzir o erro. Renomear o índice sem atualizar o service faria a violação virar `500`, e o teste de concorrência quebraria.
- As travas `FOR SHARE` são compatíveis entre si: várias criações de pedido com o mesmo produto não se bloqueiam, só uma exclusão espera por elas.
- Itens e histórico usam `uuidv7()` como chave, que no PostgreSQL 18 cresce de forma monotônica na mesma sessão. Assim, ordenar por id devolve os itens na ordem em que o pedido os listou, sem uma coluna de posição.
