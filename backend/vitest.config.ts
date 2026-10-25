import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./tests/support/global-setup.ts"],
    // Todos os arquivos usam o mesmo banco de teste; em paralelo, o TRUNCATE de um
    // apagaria os dados de outro no meio do teste.
    fileParallelism: false,
    // Sandboxes do Stryker (npm run test:mutation) trazem cópias dos testes.
    exclude: ["**/node_modules/**", "**/.stryker-tmp/**"],
  },
});
