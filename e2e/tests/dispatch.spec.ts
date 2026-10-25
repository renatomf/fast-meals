import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousA11yViolations, signIn } from "./support.ts";

const customer = "[Demo] Cliente Moema oeste";
const customerPattern = new RegExp(customer.replace(/[[\]]/g, "\\$&"));

// Rodadas anteriores deixam pedidos do cenário em entrega: o teste compara a contagem de
// antes e de depois, em vez de procurar uma linha só.
async function deliveringRows(page: Page) {
  await page.goto("/orders?status=delivering");
  await expect(page.getByRole("heading", { name: "Pedidos" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  return page.getByRole("row", { name: customerPattern }).count();
}

// O fluxo principal do desafio: cenário de demonstração, sugestão do Húngaro, aceite e o
// pedido saindo para entrega. Um login só, como nas outras suítes.
test("admin optimizes the dispatch and sends an order out for delivery", async ({ page }) => {
  await signIn(page, "admin", "/orders");
  const before = await deliveringRows(page);

  await page.getByRole("link", { name: "Despacho" }).click();
  await expect(page.getByRole("heading", { name: "Despacho" })).toBeVisible();

  await page.getByRole("button", { name: "Cenário de demonstração" }).click();
  await expect(page.getByText(/Cenário criado: 8 pedidos e 8 entregadores/)).toBeVisible();

  await page.getByRole("button", { name: "Sugerir Atribuição Otimizada" }).click();
  const summary = page.getByRole("region", { name: "Resumo da sugestão" });
  await expect(summary).toBeVisible();
  // O cenário é montado para o guloso perder: o card mostra a economia.
  await expect(summary.getByText(/km a menos/)).toBeVisible();

  const suggestion = page
    .getByRole("list", { name: "Sugestões de atribuição" })
    .getByRole("listitem")
    .filter({ hasText: customer });
  await expect(suggestion).toBeVisible();

  // A matriz de distâncias abre num diálogo acessível e fecha com Esc.
  await page.getByRole("button", { name: "Ver matriz de distâncias" }).click();
  const matrix = page.getByRole("dialog", { name: "Matriz de distâncias" });
  await expect(matrix.getByRole("table")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await page.keyboard.press("Escape");
  await expect(matrix).toBeHidden();
  await expectNoSeriousA11yViolations(page);

  await suggestion.getByRole("button", { name: /^Aceitar:/ }).click();
  await expect(suggestion.getByText("Saiu para entrega")).toBeVisible();
  // Quando a API confirma, o pedido sai da lista de prontos (só a linha da sugestão fica).
  await expect(
    page
      .getByRole("complementary", { name: "Pedidos, entregadores e sugestões" })
      .getByText(customer),
  ).toHaveCount(1);

  // E está em entrega na tela de pedidos: um a mais do que antes.
  expect(await deliveringRows(page)).toBe(before + 1);
});
