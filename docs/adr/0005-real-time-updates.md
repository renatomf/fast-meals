# ADR 0005 — Atualização em tempo real por LISTEN/NOTIFY e WebSocket

- **Status:** aceito
- **Data:** 25/10/2026

## Contexto

O painel é usado por operadores que acompanham uma fila que muda o tempo todo: pedidos chegam, a cozinha avança, entregas terminam. Sem atualização automática, o despacho mostra pedidos que outro operador já atribuiu, e quem está na tela de pedidos só vê um pedido novo se recarregar a página. O enunciado lista WebSockets no painel de pedidos como diferencial.

Requisitos que guiaram a decisão:

1. **Toda mudança aparece**, venha da API, do seed, do simulador ou de um `psql` manual.
2. **Nada a mais vaza.** O canal não pode virar um atalho que entrega dados sem as regras de permissão da API.
3. **Falha não quebra o painel.** Proxy sem suporte a WebSocket, API reiniciando ou banco fora do ar não podem deixar a tela parada sem aviso.
4. **Autenticação continua sendo a mesma.** O access token vive em memória (ADR 0004) e vence em 15 minutos.

## Decisão

**Origem dos eventos: trigger + `NOTIFY`.** A migration `0006_change_notifications` cria um trigger `AFTER INSERT OR UPDATE OR DELETE` em `orders`, `products` e `delivery_persons`, que chama `pg_notify('fastmeals_changes', ...)`. O PostgreSQL só entrega o `NOTIFY` no `COMMIT`: um rollback não avisa ninguém de algo que não aconteceu, e um teste verifica isso.

**Payload só com identificadores:** `entity`, `op`, `id` e, para pedidos, `status`. Quem recebe busca os dados pela API, com as permissões de sempre. O mesmo schema Zod (`changeEventSchema`, em `packages/contracts`) valida o payload na API e tipa a mensagem no front.

**Escuta na API.** Uma conexão dedicada, fora do pool, faz `LISTEN`. Uma conexão do pool voltaria para outros usos e perderia a inscrição. Se ela cair, inclusive num encerramento limpo, como um restart do banco, reconecta com espera crescente de 1 a 30 s.

**Entrega ao navegador: WebSocket em `/ws`** (`@fastify/websocket`, plugin oficial). O canal é só de saída: o cliente não envia nada além da autenticação.

- **O token vai na primeira mensagem, nunca na URL**, que acabaria em logs de proxy. Sem autenticação em 5 s, a conexão fecha com 4401. Nada é enviado antes disso.
- **O token é reconferido a cada heartbeat** (30 s). Quando ele vence, a conexão fecha com 4001; o front renova a sessão pela API e reconecta.
- **A origem é conferida** contra `CORS_ORIGIN`. O token não vai junto do handshake, então outro site não teria o que mandar, mas a checagem fecha a porta sem custo.
- Mensagens do cliente aceitam no máximo 4 KB, e o rate limit por IP também conta as conexões.
- Admin e viewer recebem os mesmos avisos, porque os dois podem ler tudo.

**No front, o aviso invalida o cache, não substitui os dados.** Cada entidade invalida as chaves do TanStack Query que dependem dela: pedido invalida pedidos, relatórios e entregadores (o pedido atual de cada um). Os avisos são agrupados em janelas de 250 ms, porque o simulador ou uma importação geram dezenas por segundo e cada cache precisa ser recarregado uma vez só. Ao conectar, as telas abertas recarregam, para pegar o que mudou enquanto a conexão estava fora.

**Reserva: polling.** Sem conexão, as telas abertas recarregam a cada 30 s até a conexão voltar. O cabeçalho mostra "Ao vivo" ou "Atualização a cada 30 s", para o operador saber se o que vê pode estar atrasado.

## Alternativas consideradas

| Alternativa                                    | Por que não                                                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Publicar o evento no service, depois do commit | Mudanças fora da API (seed, simulador rodando direto no banco, `psql`) não avisariam ninguém; e cada service novo teria de lembrar de publicar               |
| Mandar a linha inteira no evento               | Repetiria no canal as regras de permissão e de serialização da API, e o payload do `NOTIFY` tem limite de 8 KB                                               |
| Server-Sent Events                             | Também serviria (o canal é só de saída), mas o `EventSource` não aceita header nem corpo: o token teria de ir na URL ou num cookie lido pela rota de eventos |
| Token na query string do WebSocket             | Mais simples, mas o token acabaria em logs de acesso de proxies                                                                                              |
| Só polling                                     | Funciona, e é a reserva; como solução principal, ou a fila fica até 30 s atrasada, ou o intervalo curto multiplica as consultas de todas as telas abertas    |
| Redis pub/sub                                  | Necessário com várias instâncias da API sem banco compartilhado; aqui o PostgreSQL já entrega o pub/sub sem outro serviço no compose                         |

## Consequências

- **Várias instâncias da API funcionam sem mudança:** cada uma escuta o mesmo canal no PostgreSQL e repassa aos próprios clientes. O limite é o banco: cada instância mantém uma conexão a mais, fora do pool.
- **O trigger roda por linha.** Um `UPDATE` de 10 mil pedidos gera 10 mil avisos. O agrupamento do front absorve isso, mas uma carga em massa recorrente pediria um trigger por comando (`FOR EACH STATEMENT`) que avisasse só a entidade.
- **Um aviso perdido não deixa a tela errada para sempre:** ao reconectar, as telas recarregam, e o polling cobre o intervalo sem conexão. O canal é uma otimização de latência, não a fonte da verdade.
- **O mesmo canal invalida um cache em memória dos relatórios.** Com o painel ao vivo, cada mudança num pedido faz todo dashboard aberto pedir os mesmos relatórios ao mesmo tempo: 20 telas abertas viram 120 agregações idênticas. Com o cache ([`reports-cache.ts`](../../backend/src/modules/reports/reports-cache.ts)), a primeira tela calcula e as outras recebem pronto, e a carga deixa de crescer com o número de telas. Medido no Docker: 10 a 35 ms calculando, 0,5 a 1,5 ms do cache. Ele guarda a promessa, não o valor, então pedidos iguais simultâneos viram uma consulta só. Qualquer aviso de mudança limpa tudo, inclusive consultas em andamento; um TTL de 30 s limita a defasagem se um aviso se perder enquanto o `LISTEN` reconecta; erro não fica guardado; e um teto de 500 entradas segura a memória diante de períodos arbitrários. Sem feed de mudanças (testes que não tratam de tempo real), não há cache: sem quem avise, ele serviria dado velho.
- **As listagens ficam sem cache.** Com os índices, elas respondem bem abaixo da meta de 200 ms ([`docs/benchmarks.md`](../benchmarks.md)); cada combinação de página, filtro e ordenação seria uma chave diferente, com pouco acerto; e o aviso chega milissegundos depois da escrita, então quem acabou de mudar um pedido poderia recarregar a lista e ver o estado anterior. Num relatório, essa defasagem não tem consequência; numa lista operacional, tem.
