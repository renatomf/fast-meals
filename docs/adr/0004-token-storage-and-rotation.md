# ADR 0004 — Access token em memória, refresh token em cookie httpOnly com rotação

- **Status:** aceito
- **Data:** 23/10/2026

## Contexto

O enunciado pede JWT com access token de 15 minutos e refresh token de 7 dias, e lista "token sem httpOnly" entre as vulnerabilidades que reprovam a entrega. O `api-spec`, por outro lado, devolve o `refreshToken` no corpo do login e o recebe no corpo do `/auth/refresh`.

Três ameaças guiaram a decisão:

1. **XSS.** Qualquer token que o JavaScript da página consiga ler pode ser levado por um script injetado. Um refresh token em `localStorage` dá ao atacante 7 dias de acesso.
2. **CSRF.** Se o token vai num cookie, o navegador o envia sozinho, inclusive em requisições disparadas por outro site.
3. **Refresh token roubado.** Mesmo protegido, um refresh token pode vazar (máquina comprometida, log mal configurado). Sem nenhum controle, ele vale por 7 dias sem que ninguém perceba.

## Decisão

**Access token.** JWT HS256 assinado com `JWT_SECRET`, válido por 15 minutos, com `sub` (id do usuário) e `role`. Vai no header `Authorization: Bearer`. O front vai guardá-lo só em memória: um F5 o perde, e a sessão volta pelo refresh.

**Refresh token.** JWT HS256 assinado com um segredo próprio (`JWT_REFRESH_SECRET`), válido por 7 dias, com `sub`, `fam` (a família, ou seja, o login de origem) e `jti` aleatório. Ele é entregue de duas formas:

- no corpo da resposta, como no `api-spec`, para clientes de API (Swagger, curl, testes);
- num cookie `httpOnly; Secure; SameSite=Strict; Path=/api/auth`, que é o único que o front usa. O `/auth/refresh` aceita o token do corpo e, na falta dele, o do cookie.

No banco fica só o SHA-256 do token, com `family_id`, `expires_at`, `used_at` e `revoked_at`. Quem ler a tabela não consegue usar o que leu.

**Rotação.** Cada uso do refresh token o marca como usado e emite um novo na mesma família. A leitura é feita com `SELECT ... FOR UPDATE`, então duas renovações simultâneas com o mesmo token ficam em fila e só a primeira gera sessão.

**Detecção de reuso.** Se um token já usado reaparecer, alguém tem uma cópia dele. Não dá para saber se é o usuário ou o atacante, então revogo a família inteira: os dois perdem a sessão e o usuário legítimo faz login de novo. O evento vai para o log como `warn`. As outras sessões do mesmo usuário (outro navegador, outro login) não são afetadas.

Existe uma exceção de 10 segundos. Duas abas abertas no mesmo navegador podem renovar ao mesmo tempo com o mesmo cookie; a segunda chega logo depois da rotação feita pela primeira. Dentro dessa janela o token reapresentado recebe 401 sem revogar nada, e a aba pode tentar de novo com o cookie que a primeira já atualizou. Sem essa janela, abrir o painel em duas abas derrubaria a sessão.

**Logout** revoga a família do token apresentado e limpa o cookie. É idempotente: sem token, responde 204 do mesmo jeito.

**Login.** Senhas com bcrypt, custo 12 (o enunciado pede no mínimo 10; 12 custa cerca de 250 ms por tentativa). Quando o email não existe, comparo a senha contra um hash fixo, para que a resposta demore o mesmo e o tempo não revele quais emails estão cadastrados. A rota de login aceita 10 tentativas por minuto por IP, além do limite global de 100.

### Por que não há token anti-CSRF

O cookie só chega às rotas que o leem, e elas não executam nada que um atacante queira forjar:

- `Path=/api/auth` faz o navegador enviar o cookie apenas para `/api/auth/*`;
- `SameSite=Strict` impede o envio em qualquer requisição que comece em outro site, incluindo navegação de topo;
- `/auth/refresh` e `/auth/logout` só aceitam `POST`, e a resposta do refresh não pode ser lida por outra origem (CORS restrito a `CORS_ORIGIN`). Nem um logout forçado funciona: sem o cookie, o `/auth/logout` não tem o que revogar;
- todas as outras rotas autenticam pelo header `Authorization`, que nenhum site consegue fazer o navegador enviar sozinho.

Um token anti-CSRF (double submit) repetiria uma proteção que essas camadas já dão.

### Por que o refresh token é um JWT

Ele é validado no banco de qualquer jeito, então um valor aleatório opaco também funcionaria. Escolhi JWT por três motivos menores: a assinatura e a expiração rejeitam lixo e tokens vencidos sem ir ao banco; o `.env.example` do desafio traz um `JWT_REFRESH_SECRET`, que assim tem uso; e o formato fica igual ao exemplo do `api-spec`.

## Alternativas consideradas

| Alternativa                             | Por que não                                                                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refresh token em `localStorage`         | Exposto a XSS, e é exatamente o que o enunciado reprova                                                                                              |
| Refresh token sem rotação               | Um token vazado vale 7 dias e o roubo nunca aparece                                                                                                  |
| Sessão no servidor com cookie de sessão | Resolveria o problema, mas o enunciado pede JWT                                                                                                      |
| Revogar a família em qualquer reuso     | Duas abas renovando juntas derrubariam a sessão do usuário legítimo                                                                                  |
| Remover o `refreshToken` do corpo       | Desviaria do contrato do `api-spec` sem ganho de segurança: o risco está em o front guardar o token, e o front não o guarda                          |
| `@fastify/jwt`                          | O service de auth passaria a depender do Fastify, o que as regras de camada proíbem. Uso o `fast-jwt`, a mesma biblioteca que o plugin usa por baixo |

## Consequências

- Um access token não pode ser revogado antes de expirar: depois do logout, ou de uma troca de perfil, ele continua valendo por até 15 minutos. O prazo curto é a mitigação. Revogação imediata exigiria consultar o banco ou uma lista de bloqueio em toda requisição.
- A tabela `refresh_tokens` ganha uma linha por renovação. O login apaga os tokens vencidos do próprio usuário; em produção, um job periódico faria a limpeza geral.
- O cookie `Secure` exige HTTPS fora de `localhost` e `127.0.0.1`, que os navegadores já tratam como contexto seguro. Em produção haveria HTTPS de qualquer forma.
- O rate limit usa o IP do cliente. Atrás de um proxy, a API precisa saber em quantos saltos confiar (`TRUST_PROXY_HOPS`), senão todos os usuários dividiriam o limite do IP do proxy. No Docker esse valor é 1 (a nginx do front) e a porta 3001 só é publicada em `127.0.0.1`, para que ninguém na rede fale direto com a API forjando o `X-Forwarded-For`.
- A garantia de "um token, uma sessão" depende do `FOR UPDATE`. O teste que a cobre só passou a detectar a remoção do lock depois que abri as conexões do pool antes das requisições simultâneas (ver "Dificuldades" no `DECISIONS.md`).
