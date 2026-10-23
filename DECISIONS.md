# Decisões técnicas

Este documento registra o que escolhi, por que escolhi e o que deu errado no caminho. Decisões maiores têm um ADR próprio em [`docs/adr/`](docs/adr/).

## Arquitetura

- [ADR 0001 — Monólito modular, monorepo e contratos compartilhados](docs/adr/0001-modular-monolith-and-shared-contracts.md)

Resumo: `backend/`, `frontend/` e `packages/contracts/` num monorepo com npm workspaces. Os schemas Zod do pacote de contratos validam a API, geram o Swagger e validam os formulários do front. As fronteiras entre camadas são regras de lint, não convenção.

## Versões de plataforma

| Item       | Versão        | Motivo                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js    | 24.22.1 (LTS) | É a primeira versão da linha 24 com as correções da [release de segurança de 21/10/2026](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases), que inclui uma escrita fora dos limites de memória no decodificador Brotli do `zlib` (CVE-2026-111497, severidade alta). A versão exata está travada em `.nvmrc`, `engines` (com `engine-strict`) e nas imagens Docker. Não usei a 26.x porque ela ainda não é LTS |
| TypeScript | 6.0.3         | A 7.0 já existe, mas o `typescript-eslint` ainda declara suporte só até `<6.1`. Preferi lint confiável a um compilador mais novo                                                                                                                                                                                                                                                                                                      |
| PostgreSQL | 18.6          | Versão major atual. A imagem 18 mudou o diretório de dados, por isso o volume é montado em `/var/lib/postgresql`                                                                                                                                                                                                                                                                                                                      |
| React      | 19.3          | O enunciado pede "React 18+". Não havia motivo para começar um projeto novo numa major anterior                                                                                                                                                                                                                                                                                                                                       |

## Bibliotecas

| Biblioteca                          | Para quê                | Por que ela                                                                                                                                                      |
| ----------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fastify 5                           | Servidor HTTP           | Logs estruturados com Pino nativos, schema por rota e plugins oficiais para Swagger, CORS, helmet e rate limit. Com Express eu precisaria montar tudo isso à mão |
| Zod 4 + `fastify-type-provider-zod` | Validação               | Um schema só serve de validação, tipo TypeScript e documentação OpenAPI                                                                                          |
| `@fastify/helmet`, `@fastify/cors`  | Segurança HTTP          | Headers de segurança e CORS restrito à origem do front                                                                                                           |
| `pg`                                | Driver PostgreSQL       | O driver mais usado; o ORM entra por cima dele                                                                                                                   |
| Vite 8                              | Build do front          | Dev server rápido e proxy embutido para `/api`                                                                                                                   |
| Tailwind CSS 4                      | Estilos                 | Lê os tokens do design system direto de variáveis CSS (`@theme`)                                                                                                 |
| shadcn/ui + Radix                   | Primitivos de interface | Os componentes são copiados para o projeto e viram código meu. Radix entrega teclado, foco e ARIA corretos, que eu não quero reimplementar                       |
| Vitest                              | Testes                  | Mesmo runner no front e no back, TypeScript sem configuração                                                                                                     |
| `eslint-plugin-boundaries`          | Arquitetura             | Transforma a tabela de dependências entre camadas em erro de lint                                                                                                |

## Premissas sobre pontos ambíguos do enunciado

Levei os itens 1 e 2 à equipe. Enquanto não houver resposta, sigo as premissas abaixo.

| #   | Ponto                                                                                                                         | O que assumi                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | O `api-spec` devolve o `refreshToken` no corpo, mas os critérios eliminatórios reprovam token acessível ao front sem httpOnly | O refresh token vai apenas em cookie `httpOnly; Secure; SameSite=Strict`. O access token fica só em memória no front                    |
| 2   | Produtos indisponíveis "não aparecem nas listagens públicas", mas todas as rotas exigem login                                 | Não existe listagem pública. O painel mostra todos os produtos; só a seleção de itens de um novo pedido se limita aos disponíveis       |
| 3   | A tela de pedidos pede filtro por data, mas `GET /api/orders` só filtra por status                                            | A listagem aceita também `startDate` e `endDate`                                                                                        |
| 4   | `seed/data.json` não traz datas                                                                                               | O seed gera datas nos últimos 30 dias com semente fixa, para que os relatórios tenham conteúdo e os números se repitam em toda execução |

## Dificuldades encontradas

**O lint de arquitetura não verificava pacotes npm.** Escrevi a regra "algoritmos não importam `fastify`" e ela passava em silêncio. Criei arquivos com violações de propósito e confirmei que só as dependências locais eram checadas. A causa estava no código do plugin: pacotes externos só são avaliados com a opção `checkAllOrigins: true`, que o README não menciona. Desde então, toda regra nova de fronteira é testada com uma violação proposital antes de ser considerada pronta.

**O CLI do shadcn instalou um pacote npm desconhecido.** Ao gerar o `Button`, o CLI não encontrou o alias `@/shared/lib/cn`, porque eu tinha declarado os `paths` só no `tsconfig.app.json`. Ele tratou `cn` como nome de pacote, adicionou `cn@0.5.0` às dependências e criou o arquivo numa pasta chamada literalmente `@`. Removi o pacote, conferi o lockfile e repeti os `paths` no `frontend/tsconfig.json`, que é onde o CLI procura. A lição é revisar o diff de qualquer código e dependência gerados por ferramenta.

**Os headers de segurança sumiam no nginx.** No primeiro teste em container, a CSP e o `X-Frame-Options` não apareciam nas respostas do front. Um `add_header Cache-Control` dentro de `location` faz o nginx ignorar todos os `add_header` do bloco `server`. Troquei o cache para a diretiva `expires`, que não tem esse efeito colateral.

**Uma expectativa errada sobre CORS.** Escrevi um teste esperando que uma origem não autorizada não recebesse `Access-Control-Allow-Origin`. Com origem fixa, o `@fastify/cors` sempre devolve a origem configurada, e o navegador bloqueia porque ela não bate com a de quem pediu. O comportamento estava certo; o teste foi corrigido para verificar que a API nunca reflete uma origem arbitrária.

## Uso de IA

Usei o Claude Code como par de programação: para gerar a estrutura inicial, código repetitivo e testes, e para revisar. As decisões de arquitetura, de segurança e de versões são minhas e estão justificadas aqui e nos ADRs. Revisei cada arquivo antes de commitar e validei o comportamento com testes e com o ambiente rodando em Docker a partir de um clone limpo.
