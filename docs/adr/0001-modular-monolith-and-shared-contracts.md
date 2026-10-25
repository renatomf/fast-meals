# ADR 0001 — Monólito modular, monorepo e contratos compartilhados

- **Status:** aceito
- **Data:** 23/10/2026

## Contexto

O desafio pede uma API e um painel administrativo em TypeScript, entregues juntos e executáveis com um único `docker compose up`. O README sugere `backend/` e `frontend/` na raiz e espera os comandos `cd backend && npm run seed` e `npm run dev` nas portas 3001 e 3000.

Duas coisas me preocupavam desde o início:

1. **Divergência entre front e back.** As regras de validação (nome entre 3 e 120 caracteres, telefone no formato brasileiro, transições de status) existem nos dois lados. Escritas duas vezes, elas acabam diferentes.
2. **Arquitetura que só existe no diagrama.** É fácil desenhar camadas e, três dias depois, ter uma rota importando o banco diretamente.

## Decisão

- **Um monorepo com npm workspaces**: `backend/`, `frontend/` e `packages/contracts/`. Mantive os nomes de pasta do enunciado para que os comandos do README funcionem sem adaptação.
- **`packages/contracts`** guarda os schemas Zod e os tipos que front e back compartilham. O mesmo schema valida a requisição no Fastify, gera o OpenAPI e valida o formulário no React. O pacote é consumido como código-fonte TypeScript, sem build próprio.
- **Backend como monólito modular**: um módulo por domínio (`products`, `orders`, `dispatch`...), cada um com `routes → controller → service → repository`. Domínio e algoritmos não conhecem HTTP nem banco.
- **Os nomes de pasta sugeridos no enunciado foram mantidos.** A diferença é que, em vez de uma pasta `controllers/` com todos os controllers, cada domínio agrupa os seus arquivos. Assim, mudar a regra de pedidos é mexer numa pasta só:

  | Sugestão do enunciado                                                    | Onde está                                                                                                      |
  | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
  | `backend/src/routes`, `controllers`, `services`                          | `backend/src/modules/<domínio>/<domínio>.{routes,controller,service}.ts`                                       |
  | `backend/src/models`                                                     | `backend/src/models` (tabelas Drizzle)                                                                         |
  | `backend/src/middlewares`, `utils`, `algorithms`                         | mesmos nomes                                                                                                   |
  | `backend/prisma` ("ou outro ORM")                                        | `backend/drizzle` (migrations) e `backend/src/db/seed.ts`                                                      |
  | `backend/tests`, `frontend/tests`                                        | mesmos nomes                                                                                                   |
  | `frontend/src/App.tsx`, `hooks`, `services`, `types`, `context`, `utils` | mesmos nomes                                                                                                   |
  | `frontend/src/components`                                                | `frontend/src/design-system/{ui,components}`, ao lado de `theme` (tokens e tema claro/escuro) e `brand` (logo) |
  | `frontend/src/pages`                                                     | `frontend/src/features/<tela>/pages`, junto com os componentes, hooks e services daquela tela                  |

- **O design system tem pasta própria, em camadas.** No dia 5 o `components/` do enunciado virou `design-system/`, porque ele guardava quatro coisas diferentes: `theme` (tokens e tema), `brand` (logo), `ui` (primitivos visuais, sem regra de negócio) e `components` (componentes de produto montados sobre os primitivos, que não buscam dados). Tema e marca não dependem de nenhum componente; primitivos não conhecem componentes de produto; nada no design system conhece as telas. O lint verifica as quatro regras.

- **Backend sem etapa de build.** O Node 24 executa TypeScript nativamente (type stripping), então em produção rodo `node src/server.ts`. O `tsc` serve apenas para checagem de tipos. Isso exige sintaxe apagável (`erasableSyntaxOnly`): nada de `enum`, `namespace` ou parameter properties.
- **Fronteiras verificadas no lint** com `eslint-plugin-boundaries`. Exemplos: um algoritmo não pode importar `fastify`; uma rota não pode importar o banco; uma feature do front só importa outra pelo `index.ts` dela. Uma violação quebra o CI.

### Leitura entre módulos

Um módulo só chama outro pelo `*.service.ts` dele, mas um **repositório pode ler tabelas de outros módulos**. Escrever, só nas do próprio. Abri essa exceção quando implementei pedidos: criar um pedido precisa ler os produtos com `FOR SHARE` dentro da mesma transação que grava o pedido, e atribuir um entregador precisa travá-lo do mesmo jeito ([ADR 0003](0003-database-integrity-and-concurrency.md)). Passar por `productsService` exigiria repassar a transação entre módulos e expor travas na interface pública de outro domínio. Ler a tabela direto deixa a trava junto da consulta que depende dela.

A regra de escrita não é verificada pelo lint; é convenção, e cada caso de leitura cruzada tem um comentário dizendo por que existe.

## Alternativas consideradas

| Alternativa                                    | Por que não                                                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dois repositórios ou duas pastas sem workspace | Contratos duplicados; é exatamente o problema que eu queria evitar                                                                                                              |
| Turborepo / Nx                                 | Resolvem cache de build entre muitos pacotes. Com três pacotes, seria configuração sem retorno                                                                                  |
| Microserviços (API, despacho, relatórios)      | O domínio é pequeno e transacional: atribuir entregador e mudar status precisam acontecer na mesma transação. Separar em serviços traria consistência eventual sem nenhum ganho |
| Backend compilado com `tsc` ou `tsup`          | Funciona, mas adiciona um `dist/` e uma etapa a mais no Docker. O type stripping do Node 24 resolve o mesmo problema com menos peças                                            |
| Pacote de contratos com build próprio          | Mais um passo para manter sincronizado. Consumir o código-fonte funciona tanto no Vite quanto no Node 24                                                                        |

## Consequências

- Uma mudança de contrato quebra a compilação do front e do back ao mesmo tempo, o que é o efeito desejado.
- O Dockerfile precisa da raiz do repositório como contexto, porque o backend e o front dependem do workspace `contracts`.
- A restrição de sintaxe apagável no backend me impede de usar `enum`. Uso uniões de strings literais, que também são o que o Zod produz.
- As regras de fronteira precisam ser testadas: o plugin já ignorou em silêncio pacotes npm (dia 1) e imports dentro do mesmo módulo (dia 3), os dois por opções desligadas por padrão. Ver "Dificuldades" no `DECISIONS.md`.
- Os services recebem o repositório pela factory, então podem ser testados com um falso, sem banco ([`orders.service.test.ts`](../../backend/tests/orders.service.test.ts)). Eles conhecem o tipo do cliente Drizzle e abrem as próprias transações: escolhi não esconder isso atrás de uma interface `UnitOfWork`, porque as travas e as escritas condicionais fazem parte da regra, não são detalhe de infraestrutura.
- Se o sistema crescer a ponto de precisar de outro serviço, os módulos já têm fronteiras explícitas. Extrair um deles seria mover uma pasta e trocar chamadas de função por chamadas de rede, não reescrever.
