import { expect, test, type Page } from "@playwright/test";
import { signIn, uniqueCustomer } from "./support.ts";

// Uma página por suíte, num login só: o limite de login é por IP, e o refresh token
// rotaciona a cada uso, então não dá para reaproveitar um cookie salvo entre testes.
test.describe.configure({ mode: "serial" });

let page: Page;

test.describe("admin", () => {
  const customer = uniqueCustomer("Cliente E2E");

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await signIn(page, "admin", "/orders");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("validates the new order form before sending it", async () => {
    await page.getByRole("button", { name: "Novo pedido" }).click();
    const sheet = page.getByRole("dialog", { name: "Novo pedido" });
    await sheet.getByRole("button", { name: "Criar pedido" }).click();

    await expect(
      sheet.getByText("O nome do cliente deve ter entre 3 e 100 caracteres"),
    ).toBeVisible();
    await expect(sheet.getByLabel("Cliente")).toHaveAttribute("aria-invalid", "true");
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("creates an order and opens it", async () => {
    await page.getByRole("button", { name: "Novo pedido" }).click();
    const sheet = page.getByRole("dialog", { name: "Novo pedido" });
    await sheet.getByLabel("Cliente").fill(customer);
    await sheet.getByLabel("Telefone").fill("(11) 98765-4321");
    await sheet.getByLabel("Endereço de entrega").fill("Avenida Paulista, 1578 - Bela Vista");
    const product = sheet.getByLabel("Produto 1", { exact: true });
    await expect(product.locator("option")).not.toHaveCount(1);
    await product.selectOption({ index: 1 });
    await sheet.getByLabel("Quantidade do produto 1", { exact: true }).fill("2");
    await sheet.getByRole("button", { name: "Criar pedido" }).click();

    // Ao criar, o drawer do pedido novo abre, e o id dele vai para a URL.
    const details = page.getByRole("dialog", { name: customer });
    await expect(details).toBeVisible();
    await expect(page).toHaveURL(/order=[0-9a-f-]{36}/);
    await expect(details.getByText("Pendente").first()).toBeVisible();
  });

  test("moves the order through the kitchen and keeps the change after reload", async () => {
    const details = page.getByRole("dialog", { name: customer });

    await details.getByRole("button", { name: "Iniciar preparo" }).click();
    await expect(details.getByRole("button", { name: "Marcar como pronto" })).toBeEnabled();
    await details.getByRole("button", { name: "Marcar como pronto" }).click();

    // Pronto sem entregador: sair para entrega fica bloqueado, cancelar continua possível.
    await expect(details.getByRole("button", { name: "Saiu para entrega" })).toBeDisabled();

    // O drawer está na URL: o F5 reabre o mesmo pedido, com o status vindo do servidor.
    await page.reload();
    const reopened = page.getByRole("dialog", { name: customer });
    await expect(reopened.getByRole("button", { name: "Saiu para entrega" })).toBeDisabled();
    await expect(reopened.getByText("Em preparo").first()).toBeVisible();
  });

  test("asks before cancelling, then cancels", async () => {
    const details = page.getByRole("dialog", { name: customer });
    await details.getByRole("button", { name: "Cancelar pedido" }).click();

    const confirm = page.getByRole("alertdialog", { name: "Cancelar este pedido?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancelar pedido" }).click();

    await expect(confirm).toBeHidden();
    // Estado final: nenhuma ação sobra.
    await expect(details.getByRole("button", { name: "Cancelar pedido" })).toHaveCount(0);
    await expect(details.getByText("Cancelado").first()).toBeVisible();
  });

  test("finds the cancelled order through the status filter", async () => {
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Cancelado" }).click();
    await expect(page).toHaveURL(/status=cancelled/);
    await expect(page.getByRole("row", { name: new RegExp(customer) })).toBeVisible();
  });
});

test.describe("viewer", () => {
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await signIn(page, "viewer", "/orders?status=pending");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("sees the orders but every action is disabled", async () => {
    await expect(page.getByText("Somente leitura")).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo pedido" })).toBeDisabled();

    await page.getByRole("row").nth(1).click();
    const details = page.getByRole("dialog");
    await expect(details.getByRole("button", { name: "Iniciar preparo" })).toBeDisabled();
    await expect(details.getByRole("button", { name: "Cancelar pedido" })).toBeDisabled();
  });

  test("sees the dispatch board but cannot optimize or create scenarios", async () => {
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Despacho" }).click();
    await expect(page.getByRole("heading", { name: "Despacho" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sugerir Atribuição Otimizada" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Cenário de demonstração" })).toBeDisabled();
    await expect(page.getByRole("region", { name: "Mapa de despacho" })).toBeVisible();
  });
});
