import type { Product } from "@fastmeals/contracts";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { App } from "../src/app.ts";
import { seedOfficialData } from "../src/db/seed-official.ts";
import { apiClient, tokenFor, type ApiClient } from "./support/api.ts";
import { buildTestApp } from "./support/app.ts";
import { connectTestDatabase, truncateAll } from "./support/database.ts";

const { pool, db } = connectTestDatabase();
let app: App;
let admin: ApiClient;
let viewer: ApiClient;
let anonymous: ApiClient;
let adminToken: string;
let viewerToken: string;

const validProduct = {
  name: "Suco de Laranja Natural",
  description: "Suco de laranja natural, feito na hora, 500ml",
  price: 12.5,
  category: "drink",
  imageUrl: "https://example.com/suco.jpg",
  preparationTime: 5,
};

beforeAll(async () => {
  await truncateAll(db);
  await seedOfficialData(db);
  adminToken = await tokenFor(db, "admin");
  viewerToken = await tokenFor(db, "viewer");
});

beforeEach(async () => {
  app = await buildTestApp({ db });
  admin = apiClient(app, adminToken);
  viewer = apiClient(app, viewerToken);
  anonymous = apiClient(app);
});

afterEach(async () => {
  await app.close();
});

afterAll(async () => {
  await pool.end();
});

async function productNamed(name: string): Promise<Product> {
  const response = await admin.get(`/products?search=${encodeURIComponent(name)}`);
  const product = response.json<{ data: Product[] }>().data.find((item) => item.name === name);
  if (!product) throw new Error(`Seed product ${name} not found`);
  return product;
}

describe("GET /api/products", () => {
  it("paginates the 15 seeded products, newest first by default", async () => {
    const response = await admin.get("/products?limit=5&page=3");

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.pagination).toEqual({ page: 3, limit: 5, total: 15, totalPages: 3 });
    expect(body.data).toHaveLength(5);
    expect(body.data.at(-1).name).toBe("X-Burger Especial");
  });

  it("returns the fields of the api-spec, with price as a number", async () => {
    const product = await productNamed("X-Burger Especial");

    expect(product).toEqual({
      id: expect.any(String),
      name: "X-Burger Especial",
      description: expect.stringContaining("Hamburguer artesanal"),
      price: 32.9,
      category: "meal",
      imageUrl: expect.stringMatching(/^https:\/\//),
      isAvailable: true,
      preparationTime: 25,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it("searches by name, case-insensitively and by part of the word", async () => {
    const response = await admin.get("/products?search=BURG");

    expect(response.json().data.map((product: Product) => product.name)).toEqual([
      "X-Burger Especial",
    ]);
  });

  it("treats % in the search term as text, not as a wildcard", async () => {
    const response = await admin.get("/products?search=%25");

    expect(response.json().pagination.total).toBe(0);
  });

  it("filters by category", async () => {
    const response = await admin.get("/products?category=dessert");

    const names = response.json().data.map((product: Product) => product.name);
    expect(names.sort()).toEqual([
      "Acai 500ml",
      "Brownie com Sorvete",
      "Pudim de Leite Condensado",
    ]);
  });

  it('filters by availability, reading "false" as false', async () => {
    const response = await admin.get("/products?isAvailable=false");

    expect(response.json().data.map((product: Product) => product.name)).toEqual([
      "Wrap de Carne Seca",
    ]);
  });

  it("sorts by price", async () => {
    const response = await admin.get("/products?sortBy=price&sortOrder=asc&limit=100");

    const prices = response.json().data.map((product: Product) => product.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(prices[0]).toBe(5);
  });

  it("refuses more than 100 items per page", async () => {
    const response = await admin.get("/products?limit=101");

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details).toEqual([
      { field: "limit", message: "O limite máximo é 100 itens por página" },
    ]);
  });

  it("lets the viewer read", async () => {
    expect((await viewer.get("/products")).statusCode).toBe(200);
  });

  it("requires authentication", async () => {
    expect((await anonymous.get("/products")).statusCode).toBe(401);
  });
});

describe("GET /api/products/:id", () => {
  it("returns 404 PRODUCT_NOT_FOUND for an unknown id", async () => {
    const response = await admin.get("/products/00000000-0000-4000-8000-000000000000");

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: "PRODUCT_NOT_FOUND", message: "Produto não encontrado" },
    });
  });

  it("returns 400 for an id that is not a UUID", async () => {
    expect((await admin.get("/products/42")).statusCode).toBe(400);
  });
});

describe("POST /api/products", () => {
  it("criação válida: creates the product, available and without image by default", async () => {
    const response = await admin.post("/products", {
      ...validProduct,
      imageUrl: undefined,
    });

    expect(response.statusCode).toBe(201);
    const created = response.json();
    expect(created).toMatchObject({
      name: validProduct.name,
      price: 12.5,
      isAvailable: true,
      imageUrl: null,
    });
    expect((await admin.get(`/products/${created.id}`)).statusCode).toBe(200);
  });

  it("validação de campos: answers 400 with one message per invalid field", async () => {
    const response = await admin.post("/products", {
      name: "ab",
      description: "curta",
      price: 0,
      category: "pizza",
      imageUrl: "javascript:alert(1)",
      preparationTime: 0,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    expect(response.json().error.details).toEqual(
      expect.arrayContaining([
        { field: "name", message: "O nome deve ter entre 3 e 120 caracteres" },
        { field: "description", message: "A descrição deve ter entre 10 e 500 caracteres" },
        { field: "price", message: "O preço deve ser maior que zero" },
        { field: "category", message: "A categoria deve ser meal, drink, dessert, side" },
        { field: "imageUrl", message: "A imagem deve ser uma URL http(s) válida" },
        { field: "preparationTime", message: "O tempo de preparo deve ser entre 1 e 120 minutos" },
      ]),
    );
  });

  it("refuses a price with more than two decimals", async () => {
    const response = await admin.post("/products", { ...validProduct, price: 12.345 });

    expect(response.json().error.details).toEqual([
      { field: "price", message: "O valor deve ter no máximo 2 casas decimais" },
    ]);
  });

  it("forbids the viewer", async () => {
    const response = await viewer.post("/products", validProduct);

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("FORBIDDEN");
  });
});

describe("PUT /api/products/:id", () => {
  it("changes only the fields sent", async () => {
    const wrap = await productNamed("Wrap de Carne Seca");

    const response = await admin.put(`/products/${wrap.id}`, { price: 27.9 });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ price: 27.9, isAvailable: false, name: wrap.name });
    expect(Date.parse(response.json().updatedAt)).toBeGreaterThan(Date.parse(wrap.updatedAt));
  });

  it("toggles availability", async () => {
    const created = (await admin.post("/products", validProduct)).json();

    const response = await admin.put(`/products/${created.id}`, { isAvailable: false });

    expect(response.json().isAvailable).toBe(false);
  });

  it("refuses an empty body", async () => {
    const wrap = await productNamed("Wrap de Carne Seca");

    expect((await admin.put(`/products/${wrap.id}`, {})).statusCode).toBe(400);
  });

  it("returns 404 for an unknown product", async () => {
    const response = await admin.put("/products/00000000-0000-4000-8000-000000000000", {
      price: 10,
    });

    expect(response.statusCode).toBe(404);
  });

  it("forbids the viewer", async () => {
    const wrap = await productNamed("Wrap de Carne Seca");

    expect((await viewer.put(`/products/${wrap.id}`, { price: 1 })).statusCode).toBe(403);
  });
});

describe("DELETE /api/products/:id", () => {
  it("deletes a product that is in no order", async () => {
    const created = (await admin.post("/products", validProduct)).json();

    const response = await admin.delete(`/products/${created.id}`);

    expect(response.statusCode).toBe(204);
    expect((await admin.get(`/products/${created.id}`)).statusCode).toBe(404);
    expect((await admin.delete(`/products/${created.id}`)).statusCode).toBe(404);
  });

  it.each(["X-Burger Especial", "Refrigerante Lata 350ml"])(
    "refuses to delete %s, which is in a pending or preparing order",
    async (name) => {
      const product = await productNamed(name);

      const response = await admin.delete(`/products/${product.id}`);

      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({
        error: {
          code: "PRODUCT_IN_USE",
          message:
            "Não é possível deletar este produto pois ele está vinculado a pedidos com status 'pending' ou 'preparing'",
        },
      });
      expect((await admin.get(`/products/${product.id}`)).statusCode).toBe(200);
    },
  );

  it("deletes a product that only appears in closed orders, keeping it in those orders", async () => {
    const acai = await productNamed("Acai 500ml");

    expect((await admin.delete(`/products/${acai.id}`)).statusCode).toBe(204);

    const orders = (await admin.get("/orders?status=delivered&limit=100")).json();
    const names = orders.data.flatMap((order: { items: { product: { name: string } }[] }) =>
      order.items.map((item) => item.product.name),
    );
    expect(names).toContain("Acai 500ml");
  });

  it("forbids the viewer", async () => {
    const wrap = await productNamed("Wrap de Carne Seca");

    expect((await viewer.delete(`/products/${wrap.id}`)).statusCode).toBe(403);
  });
});

describe("deleted products", () => {
  it("disappear from the listing", async () => {
    const created = (
      await admin.post("/products", { ...validProduct, name: "Item a excluir" })
    ).json();
    await admin.delete(`/products/${created.id}`);

    const response = await admin.get("/products?search=Item%20a%20excluir");

    expect(response.json().pagination.total).toBe(0);
  });

  it("cannot be used in a new order", async () => {
    const created = (
      await admin.post("/products", { ...validProduct, name: "Item retirado" })
    ).json();
    await admin.delete(`/products/${created.id}`);

    const response = await admin.post("/orders", {
      customerName: "Cliente Teste",
      customerPhone: "(11) 91111-2222",
      deliveryAddress: "Rua de Teste, 100, São Paulo",
      latitude: -23.55,
      longitude: -46.63,
      items: [{ productId: created.id, quantity: 1 }],
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.details).toEqual([
      { productId: created.id, productName: null, reason: "Produto não encontrado" },
    ]);
  });
});
