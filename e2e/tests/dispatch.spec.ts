import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations, signIn } from "./support.ts";

// O fluxo principal do desafio: cenário de demonstração, sugestão do Húngaro, aceite e o
// pedido saindo para entrega. Um login só, como nas outras suítes.
test("admin optimizes the dispatch and sends an order out for delivery", async ({ page }) => {
  await signIn(page, "admin", "/dispatch");
  await expect(page.getByRole("heading", { name: "Despacho" })).toBeVisible();

  await page.getByRole("button", { name: "Cenário de demonstração" }).click();
  await expect(page.getByText(/Cenário criado: 8 pedidos e 8 entregadores/)).toBeVisible();

  await page.getByRole("button", { name: "Sugerir Atribuição Otimizada" }).click();
  const summary = page.getByRole("region", { name: "Resumo da sugestão" });
  await expect(summary).toBeVisible();
  // O cenário é montado para o guloso perder: o card mostra a economia.
  await expect(summary.getByText(/km a menos/)).toBeVisible();

  const suggestions = page.getByRole("list", { name: "Sugestões de atribuição" });
  const demoSuggestion = suggestions
    .getByRole("listitem")
    .filter({ hasText: "[Demo] Cliente Moema oeste" });
  const customer = "[Demo] Cliente Moema oeste";
  await expect(demoSuggestion).toBeVisible();

  // A matriz de distâncias abre num diálogo acessível e fecha com Esc.
  await page.getByRole("button", { name: "Ver matriz de distâncias" }).click();
  const matrix = page.getByRole("dialog", { name: "Matriz de distâncias" });
  await expect(matrix.getByRole("table")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await page.keyboard.press("Escape");
  await expect(matrix).toBeHidden();

  await expectNoSeriousA11yViolations(page);

  await demoSuggestion.getByRole("button", { name: /^Aceitar:/ }).click();
  await expect(demoSuggestion.getByText("Saiu para entrega")).toBeVisible();
  // Saiu da lista de prontos assim que a API confirmou.
  await expect(
    page
      .getByRole("complementary", { name: "Pedidos, entregadores e sugestões" })
      .getByText(customer),
  ).toHaveCount(1);

  // E está em entrega, com entregador, na tela de pedidos.
  await page.goto("/orders?status=delivering");
  const row = page.getByRole("row", { name: new RegExp(customer.replace(/[[\]]/g, "\\$&")) });
  await expect(row).toBeVisible();
  await expect(row.getByText("Em entrega")).toBeVisible();
});
