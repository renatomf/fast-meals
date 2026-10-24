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

Segue as pastas sugeridas no enunciado. O que pertence a uma tela fica agrupado na própria feature:

```
src/
├── App.tsx          raiz da aplicação
├── main.tsx         entrada: tema e render
├── components/      design system do produto (PageHeader, MetricCard, DataTable...)
│   └── ui/          primitivos shadcn/ui ajustados à identidade do produto
├── context/         sessão (AuthContext)
├── hooks/           hooks compartilhados
├── services/        cliente HTTP e configuração do TanStack Query
├── types/           tipos do front que não vêm dos contratos
├── utils/           formatação, classes, tema
├── styles/          tokens (cores, tipografia, raios, status) e estilos globais
└── features/<tela>/
    ├── pages/       páginas
    ├── components/  componentes da tela
    ├── hooks/       consultas e mutações
    ├── services/    chamadas à API
    └── index.ts     o que a feature expõe para o resto do app
tests/               testes de componentes e de integração
```

Toda cor vem dos tokens: o lint recusa cores hexadecimais soltas nas classes. Componentes do design system não buscam dados, e uma feature só usa outra pelo `index.ts` dela.
