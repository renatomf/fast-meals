import { expect, test } from "@playwright/test";
import { signIn, uniqueCustomer } from "./support.ts";

// Duas abas do mesmo navegador: a segunda entra pelo cookie de refresh, sem outro login.
// O pedido criado numa aba aparece na outra sem recarregar: banco → NOTIFY → WebSocket →
// invalidação do cache → nova busca.
test("an order created in one tab shows up in the other without reloading", async ({
  page,
  context,
}) => {
  const customer = uniqueCustomer("Tempo real");
  await signIn(page, "admin", "/orders?status=pending");
  await expect(page.getByRole("status").filter({ hasText: "Ao vivo" })).toBeVisible();

  const other = await context.newPage();
  await other.goto("/orders");
  await other.getByRole("button", { name: "Novo pedido" }).click();
  const sheet = other.getByRole("dialog", { name: "Novo pedido" });
  await sheet.getByLabel("Cliente").fill(customer);
  await sheet.getByLabel("Telefone").fill("(11) 98765-4321");
  await sheet.getByLabel("Endereço de entrega").fill("Rua Haddock Lobo, 595 - Cerqueira César");
  const product = sheet.getByLabel("Produto 1", { exact: true });
  await expect(product.locator("option")).not.toHaveCount(1);
  await product.selectOption({ index: 1 });
  await sheet.getByRole("button", { name: "Criar pedido" }).click();
  await expect(other.getByRole("dialog", { name: customer })).toBeVisible();

  // A primeira aba não foi tocada desde o login.
  await expect(page.getByRole("row", { name: new RegExp(customer) })).toBeVisible({
    timeout: 5_000,
  });
});
