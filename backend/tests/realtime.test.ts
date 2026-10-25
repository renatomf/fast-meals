import { REALTIME_CLOSE, type ChangeEvent } from "@fastmeals/contracts";
import { eq, sql } from "drizzle-orm";
import Fastify from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { App } from "../src/app.ts";
import { seedOfficialData } from "../src/db/seed-official.ts";
import { products } from "../src/models/index.ts";
import { createChangeHub, createPostgresChangeFeed } from "../src/modules/realtime/change-feed.ts";
import { tokenFor } from "./support/api.ts";
import { buildTestApp } from "./support/app.ts";
import { connectTestDatabase, TEST_DATABASE_URL, truncateAll } from "./support/database.ts";

const { pool, db } = connectTestDatabase();

beforeAll(async () => {
  await truncateAll(db);
  await seedOfficialData(db);
});

afterAll(() => pool.end());

type Message = { type: string; event?: ChangeEvent };

// Junta as mensagens e o fechamento de um socket, para os testes esperarem por eles.
function watch(socket: WebSocket) {
  const messages: Message[] = [];
  const closed = new Promise<number>((resolve) => socket.on("close", (code) => resolve(code)));
  socket.on("message", (raw) => messages.push(JSON.parse(String(raw)) as Message));
  const next = (type: string) =>
    expect.poll(() => messages.find((message) => message.type === type), { timeout: 2_000 });
  return { messages, closed, next };
}

const sampleEvent: ChangeEvent = {
  entity: "orders",
  op: "update",
  id: "0190a0b0-0000-7000-8000-0000000000aa",
  status: "ready",
};

describe("WebSocket /ws", () => {
  const hub = createChangeHub();
  let app: App;

  let url: string;

  // Servidor de verdade numa porta livre: o injectWS simula um socket sem endereço, e o
  // rate limit (que conta por IP) recusa a conexão antes de ela chegar à rota.
  beforeAll(async () => {
    app = await buildTestApp({ db, changeFeed: hub });
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    url = `ws://127.0.0.1:${address.port}/ws`;
  });

  function connect(origin?: string) {
    const socket = new WebSocket(url, origin ? { headers: { origin } } : {});
    return new Promise<WebSocket>((resolve, reject) => {
      socket.once("open", () => resolve(socket));
      socket.once("error", reject);
    });
  }

  afterAll(() => app.close());

  it("forwards changes to an authenticated client, viewer included", async () => {
    const socket = await connect();
    const { next } = watch(socket);

    socket.send(JSON.stringify({ type: "auth", token: await tokenFor(db, "viewer") }));
    await next("ready").toBeDefined();
    hub.publish(sampleEvent);

    await next("change").toEqual({ type: "change", event: sampleEvent });
    socket.terminate();
  });

  it("sends nothing before authentication and closes on an invalid token", async () => {
    const socket = await connect();
    const { messages, closed } = watch(socket);

    hub.publish(sampleEvent);
    socket.send(JSON.stringify({ type: "auth", token: "not-a-jwt" }));

    expect(await closed).toBe(REALTIME_CLOSE.unauthorized);
    expect(messages).toEqual([]);
  });

  it("closes on a message that is not an auth message", async () => {
    const socket = await connect();
    const { closed } = watch(socket);

    socket.send("hello");

    expect(await closed).toBe(REALTIME_CLOSE.unauthorized);
  });

  it("refuses connections from another origin", async () => {
    const socket = await connect("https://evil.example");
    const { closed } = watch(socket);

    expect(await closed).toBe(REALTIME_CLOSE.forbiddenOrigin);
  });

  it("stops delivering to a client that disconnected", async () => {
    const socket = await connect();
    const { next, closed } = watch(socket);
    socket.send(JSON.stringify({ type: "auth", token: await tokenFor(db, "admin") }));
    await next("ready").toBeDefined();
    const subscribed = hub.size;

    socket.close();
    await closed;

    await expect.poll(() => hub.size).toBe(subscribed - 1);
  });
});

// O caminho inteiro do banco: trigger da migration 0006 → NOTIFY → LISTEN da API.
describe("Postgres change feed", () => {
  const feed = createPostgresChangeFeed(TEST_DATABASE_URL);
  const received: ChangeEvent[] = [];

  beforeAll(async () => {
    feed.subscribe((event) => received.push(event));
    await feed.start(Fastify({ logger: false }).log);
  });

  afterEach(() => {
    received.length = 0;
  });

  afterAll(() => feed.stop());

  it("publishes committed changes with the entity, operation and id", async () => {
    const [product] = await db.select({ id: products.id }).from(products).limit(1);
    if (!product) throw new Error("seed has no products");

    await db.update(products).set({ preparationTime: 7 }).where(eq(products.id, product.id));

    await expect
      .poll(() => received)
      .toContainEqual({ entity: "products", op: "update", id: product.id, status: null });
  });

  it("includes the status of orders", async () => {
    const [order] = await db
      .execute<{ id: string; status: string }>(
        sql`update orders set status = status where id = (select id from orders limit 1) returning id, status`,
      )
      .then((result) => result.rows);
    if (!order) throw new Error("seed has no orders");

    await expect
      .poll(() => received)
      .toContainEqual({ entity: "orders", op: "update", id: order.id, status: order.status });
  });

  it("says nothing about a transaction that rolled back", async () => {
    const [product] = await db.select({ id: products.id }).from(products).limit(1);
    if (!product) throw new Error("seed has no products");

    await db
      .transaction(async (tx) => {
        await tx.update(products).set({ preparationTime: 9 }).where(eq(products.id, product.id));
        tx.rollback();
      })
      .catch(() => {});
    // Uma mudança confirmada depois serve de marcador: quando ela chega, a anterior já teria chegado.
    await db.update(products).set({ preparationTime: 8 }).where(eq(products.id, product.id));

    await expect.poll(() => received.length).toBe(1);
  });
});
