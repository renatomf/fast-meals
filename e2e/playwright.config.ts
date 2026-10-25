import { defineConfig, devices } from "@playwright/test";

// Roda contra o ambiente do docker compose (nginx na 3000), o mesmo que o avaliador sobe.
// O dev server (npm run dev) usa a mesma porta. Para outro endereço: E2E_BASE_URL=... npm run test:e2e
export default defineConfig({
  testDir: "./tests",
  // Um worker: o login aceita 10 tentativas por minuto por IP, e as suítes compartilham o banco.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  // Sem retry: a suíte inteira faz 7 logins, e repetir testes no mesmo minuto esbarraria
  // no limite de login, trocando a falha real por um 429.
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
