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

```
src/
├── app/             providers, layout e rotas
├── design-system/
│   ├── tokens/      cores, tipografia, raios e status (temas claro e escuro)
│   └── ui/          primitivos shadcn/ui ajustados à identidade do produto
└── shared/          utilitários sem regra de negócio
```

Toda cor vem dos tokens: o lint recusa cores hexadecimais soltas nas classes.
