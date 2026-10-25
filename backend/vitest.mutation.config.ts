import { defineConfig } from "vitest/config";

// Só os testes puros do algoritmo e da máquina de estados: o Stryker roda a suíte centenas
// de vezes, uma por mutação, e estes não precisam de banco.
export default defineConfig({
  test: {
    // Pula os testes que medem tempo (veja assignment.test.ts).
    env: { MUTATION_RUN: "1" },
    include: [
      "tests/assignment.test.ts",
      "tests/haversine.test.ts",
      "tests/order-state-machine.test.ts",
    ],
  },
});
