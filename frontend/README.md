# FastMeals — Frontend

Painel administrativo em React 19, Vite 8, Tailwind CSS 4 e componentes shadcn/ui customizados.

## Requisitos

- Node.js 24.22.1+ (linha 24; veja `../.nvmrc`)
- Backend rodando em `http://localhost:3001` (veja [`../backend/README.md`](../backend/README.md))

## Comandos

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # gera dist/
npm run preview    # serve o build
npm test
npm run typecheck
```

O dev server encaminha `/api` e `/ws` para o backend. Front e API ficam na mesma origem, o que permite guardar o refresh token num cookie httpOnly com `SameSite=Strict`. No Docker, o nginx faz o mesmo papel.

Para apontar o proxy para outra API: `API_PROXY_TARGET=http://outro-host:3001 npm run dev`.

## Organização

Segue as pastas sugeridas no enunciado, com o design system numa pasta própria, em camadas ([ADR 0001](../docs/adr/0001-modular-monolith-and-shared-contracts.md)). O que pertence a uma tela fica agrupado na própria feature:

```
src/
├── App.tsx          raiz da aplicação
├── main.tsx         entrada: tema e render
├── design-system/   identidade e componentes reutilizáveis, em camadas
│   ├── theme/       tokens (cores, tipografia, raios, status), estilos globais, tema claro/escuro
│   ├── brand/       logo e símbolo
│   ├── ui/          primitivos (Button, Input, Dialog...) baseados no shadcn/ui
│   └── components/  componentes de produto (PageHeader, MetricCard, DataTable...)
├── context/         sessão (AuthContext)
├── hooks/           hooks compartilhados
├── services/        cliente HTTP e configuração do TanStack Query
├── types/           tipos do front que não vêm dos contratos
├── utils/           formatação e classes
└── features/<tela>/
    ├── pages/       páginas
    ├── components/  componentes da tela
    ├── hooks/       consultas e mutações
    ├── services/    chamadas à API
    └── index.ts     o que a feature expõe para o resto do app
tests/               testes de componentes e de integração
```

Toda cor vem dos tokens: o lint recusa cores hexadecimais soltas nas classes. O lint também verifica as camadas: tema e marca não dependem de componentes, primitivos não conhecem componentes de produto, nada no design system busca dados nem conhece telas, e uma feature só usa outra pelo `index.ts` dela.

## Identidade visual

O verde da marca (`#06C167`) aparece no logo, no item ativo da navegação, no foco e nos indicadores positivos. As ações principais ficam em preto (branco no tema escuro): um botão verde se confundiria com o status "Entregue". O único botão verde do produto é a variante `brand`, reservada à sugestão de atribuição no despacho.

## Rotas e sessão

| Rota                | Tela                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `/login`            | Login, com contas de demonstração                                                                                          |
| `/`                 | Visão geral: métricas do período contra o período anterior, receita diária, pedidos por status e pedidos que pedem atenção |
| `/orders`           | Pedidos: filtros, paginação, detalhes com histórico, ações de status e novo pedido                                         |
| `/dispatch`         | Despacho: mapa, sugestão do Húngaro comparada ao guloso, matriz de distâncias, aceitar e rejeitar                          |
| `/products`         | Cardápio: busca, filtros, disponibilidade, cadastro e edição                                                               |
| `/delivery-persons` | Entregadores: situação, localização, cadastro e edição                                                                     |
| `/reports`          | Relatórios: período, métricas e gráficos                                                                                   |

Ctrl+K (⌘K no Mac) abre a paleta de comandos de qualquer tela. O cabeçalho mostra se o painel está ao vivo: as telas atualizam sozinhas pelo WebSocket e, sem ele, recarregam a cada 30 s ([ADR 0005](../docs/adr/0005-real-time-updates.md)).

Rotas fora do login exigem sessão; quem chega sem ela vai para o login e volta para onde estava depois de entrar. Filtros, página e pedido aberto ficam na URL.

## Testes

```bash
npm test
```

Os testes de integração montam o app inteiro (roteador, providers, formulários) e simulam só a rede, com MSW. Uma requisição sem handler falha o teste.
