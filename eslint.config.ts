import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

// Fronteiras de arquitetura (spec 4.1.1 e 7.1.1). Tudo é permitido por padrão;
// cada policy abaixo proíbe uma dependência que quebraria a separação de camadas.
const architecture = {
  plugins: { boundaries },
  settings: {
    "boundaries/root-path": import.meta.dirname,
    "import/resolver": {
      typescript: {
        project: [
          "packages/*/tsconfig.json",
          "backend/tsconfig.json",
          "frontend/tsconfig.app.json",
        ],
        noWarnOnMultipleProjects: true,
      },
    },
    // A ordem importa: o primeiro descritor que casa classifica o arquivo.
    "boundaries/elements": [
      { type: "contracts", pattern: "packages/contracts/src", partialMatch: false },

      { type: "be-algorithms", pattern: "backend/src/algorithms", partialMatch: false },
      {
        type: "be-domain",
        pattern: "backend/src/modules/*/domain",
        capture: ["module"],
        partialMatch: false,
      },
      {
        type: "be-module",
        pattern: "backend/src/modules/*",
        capture: ["module"],
        partialMatch: false,
      },
      { type: "be-models", pattern: "backend/src/models", partialMatch: false },
      { type: "be-db", pattern: "backend/src/db", partialMatch: false },
      { type: "be-middlewares", pattern: "backend/src/middlewares", partialMatch: false },
      { type: "be-utils", pattern: "backend/src/utils", partialMatch: false },
      { type: "be-config", pattern: "backend/src/config", partialMatch: false },

      // Design system: tema e marca são a fundação; ui são os primitivos; components, os
      // componentes de produto montados sobre eles.
      {
        type: "fe-foundation",
        pattern: ["frontend/src/design-system/theme", "frontend/src/design-system/brand"],
        partialMatch: false,
      },
      { type: "fe-ui", pattern: "frontend/src/design-system/ui", partialMatch: false },
      {
        type: "fe-components",
        pattern: "frontend/src/design-system/components",
        partialMatch: false,
      },
      {
        type: "fe-feature",
        pattern: "frontend/src/features/*",
        capture: ["feature"],
        partialMatch: false,
      },
      {
        type: "fe-base",
        pattern: [
          "frontend/src/context",
          "frontend/src/hooks",
          "frontend/src/services",
          "frontend/src/types",
          "frontend/src/utils",
        ],
        partialMatch: false,
      },
    ],
    "boundaries/files": [
      { category: "service", pattern: "**/*.service.ts" },
      { category: "routes", pattern: "**/*.routes.ts" },
      { category: "controller", pattern: "**/*.controller.ts" },
      { category: "repository", pattern: "**/*.repository.ts" },
      { category: "app-root", pattern: "frontend/src/{App,main}.tsx" },
      // O plugin atribui todas as categorias que casam e seletores negados ("!service")
      // não casam com arquivos sem categoria. Por isso o "interno" é definido de forma
      // positiva: tudo exceto a porta de entrada pública do módulo ou da feature.
      // No backend, a convenção de nomes já diz o que é interno: só o *.service.ts é público.
      // "**" não cobre zero pastas aqui, então raiz e subpastas são listadas separadamente.
      {
        category: "module-internal",
        pattern: [
          "backend/src/modules/*/*.{routes,controller,repository,schemas}.ts",
          "backend/src/modules/*/*/**/*.ts",
        ],
      },
      {
        category: "feature-internal",
        pattern: [
          "frontend/src/features/*/!(index).{ts,tsx}",
          "frontend/src/features/*/*/**/*.{ts,tsx}",
        ],
      },
    ],
  },
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "allow",
        // Sem isso o plugin ignora pacotes npm, e "algoritmo não importa fastify" passaria em silêncio.
        checkAllOrigins: true,
        // Sem isso o plugin ignora imports dentro do mesmo módulo, e um controller poderia
        // usar o repositório do próprio módulo, pulando o service, sem nenhum aviso.
        checkInternals: true,
        policies: [
          {
            from: { element: { type: "contracts" } },
            disallow: { to: { element: { type: "!contracts" } } },
          },

          // Domínio, algoritmos e utils são puros: sem HTTP, sem banco, sem configuração.
          {
            from: { element: { types: ["be-algorithms", "be-domain", "be-utils"] } },
            disallow: {
              to: [
                {
                  element: {
                    types: ["be-module", "be-models", "be-db", "be-config", "be-middlewares"],
                  },
                },
                { module: { origin: "external", source: "fastify" } },
                { module: { origin: "external", source: "fastify-type-provider-zod" } },
                { module: { origin: "external", source: "drizzle-orm" } },
                { module: { origin: "external", source: "pg" } },
              ],
            },
          },
          // Um módulo só conversa com outro através do service público dele.
          {
            from: { element: { type: "be-module" } },
            disallow: {
              to: {
                element: {
                  types: ["be-module", "be-domain"],
                  captured: { module: "!{{from.element.captured.module}}" },
                },
                file: { categories: "module-internal" },
              },
            },
          },
          // Rotas e controllers não falam com o banco: passam sempre pelo service.
          {
            from: { file: { categories: ["routes", "controller"] } },
            disallow: {
              to: [
                { element: { types: ["be-db", "be-models"] } },
                { file: { categories: "repository" } },
              ],
            },
          },

          // Ninguém importa o ponto de entrada da aplicação.
          {
            from: {
              element: {
                types: ["fe-foundation", "fe-ui", "fe-components", "fe-feature", "fe-base"],
              },
            },
            disallow: { to: { file: { categories: "app-root" } } },
          },
          // Tema e marca não dependem de nenhum componente.
          {
            from: { element: { type: "fe-foundation" } },
            disallow: { to: { element: { types: ["fe-ui", "fe-components", "fe-feature"] } } },
          },
          // Primitivos de UI não conhecem nada acima deles.
          {
            from: { element: { type: "fe-ui" } },
            disallow: { to: { element: { types: ["fe-components", "fe-feature"] } } },
          },
          // Componentes do design system não têm regra de negócio nem buscam dados.
          {
            from: { element: { type: "fe-components" } },
            disallow: {
              to: [
                { element: { type: "fe-feature" } },
                { module: { origin: "external", source: "@tanstack/react-query" } },
              ],
            },
          },
          // Uma feature só importa outra pelo index.ts público.
          {
            from: { element: { type: "fe-feature" } },
            disallow: {
              to: {
                element: {
                  type: "fe-feature",
                  captured: { feature: "!{{from.element.captured.feature}}" },
                },
                file: { categories: "feature-internal" },
              },
            },
          },
          // Contexto, hooks, services, tipos e utils são a base: não dependem de telas.
          {
            from: { element: { type: "fe-base" } },
            disallow: {
              to: { element: { types: ["fe-ui", "fe-components", "fe-feature"] } },
            },
          },
        ],
      },
    ],
  },
};

export default defineConfig(
  globalIgnores([
    "**/dist",
    "**/coverage",
    "**/node_modules",
    "backend/drizzle",
    "**/.stryker-tmp",
    "backend/reports",
  ]),
  js.configs.recommended,
  tseslint.configs.strict,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // Cores soltas fogem dos tokens; toda cor vem de src/design-system/theme/tokens.css.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/\\[#[0-9a-fA-F]{3,8}\\]/]",
          message: "Use um token de cor do design system em vez de uma cor arbitrária.",
        },
      ],
    },
  },
  architecture,
);
