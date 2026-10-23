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
      { type: "be-db", pattern: "backend/src/db", partialMatch: false },
      { type: "be-shared", pattern: "backend/src/shared", partialMatch: false },
      { type: "be-config", pattern: "backend/src/config", partialMatch: false },

      { type: "fe-ui", pattern: "frontend/src/design-system/ui", partialMatch: false },
      { type: "fe-design-system", pattern: "frontend/src/design-system", partialMatch: false },
      {
        type: "fe-feature",
        pattern: "frontend/src/features/*",
        capture: ["feature"],
        partialMatch: false,
      },
      { type: "fe-shared", pattern: "frontend/src/shared", partialMatch: false },
      { type: "fe-app", pattern: "frontend/src/app", partialMatch: false },
    ],
    "boundaries/files": [
      { category: "service", pattern: "**/*.service.ts" },
      { category: "routes", pattern: "**/*.routes.ts" },
      { category: "repository", pattern: "**/*.repository.ts" },
      { category: "feature-public", pattern: "frontend/src/features/*/index.ts" },
    ],
  },
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "allow",
        // Sem isso o plugin ignora pacotes npm, e "algoritmo não importa fastify" passaria em silêncio.
        checkAllOrigins: true,
        policies: [
          {
            from: { element: { type: "contracts" } },
            disallow: { to: { element: { type: "!contracts" } } },
          },

          // Domínio e algoritmos são puros: sem HTTP, sem banco, sem configuração.
          {
            from: { element: { types: ["be-algorithms", "be-domain"] } },
            disallow: {
              to: [
                { element: { types: ["be-module", "be-db", "be-config", "be-shared"] } },
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
                file: { categories: "!service" },
              },
            },
          },
          // Rotas não falam com o banco: passam sempre pelo service.
          {
            from: { file: { categories: "routes" } },
            disallow: {
              to: [{ element: { type: "be-db" } }, { file: { categories: "repository" } }],
            },
          },

          {
            from: { element: { type: "fe-ui" } },
            disallow: {
              to: { element: { types: ["fe-design-system", "fe-feature", "fe-app"] } },
            },
          },
          {
            from: { element: { type: "fe-design-system" } },
            disallow: {
              to: [
                { element: { types: ["fe-feature", "fe-app"] } },
                { module: { origin: "external", source: "@tanstack/react-query" } },
              ],
            },
          },
          // Uma feature só importa outra pelo index.ts público.
          {
            from: { element: { type: "fe-feature" } },
            disallow: {
              to: [
                {
                  element: {
                    type: "fe-feature",
                    captured: { feature: "!{{from.element.captured.feature}}" },
                  },
                  file: { categories: "!feature-public" },
                },
                { element: { type: "fe-app" } },
              ],
            },
          },
          {
            from: { element: { type: "fe-shared" } },
            disallow: {
              to: { element: { types: ["fe-design-system", "fe-feature", "fe-app"] } },
            },
          },
        ],
      },
    ],
  },
};

export default defineConfig(
  globalIgnores(["**/dist", "**/coverage", "**/node_modules", "backend/drizzle"]),
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
      // Cores soltas fogem dos tokens; toda cor vem de design-system/tokens.
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
