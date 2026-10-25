// Simulador de operação: um restaurante funcionando, pela API, como qualquer cliente.
// Cria pedidos, avança a cozinha (pending → preparing → ready) e conclui entregas em
// andamento. Os pedidos prontos ficam para o despacho, na tela, com o tempo real mostrando
// tudo acontecer. Uso: npm run simulate (com a API rodando).
//
// Variáveis: SIMULATOR_API_URL (padrão http://localhost:3001/api), SIMULATOR_EMAIL,
// SIMULATOR_PASSWORD (padrão: o admin do seed) e SIMULATOR_INTERVAL_MS (padrão 4000).
import type {
  LoginResponse,
  Order,
  OrderList,
  OrderStatus,
  ProductList,
} from "@fastmeals/contracts";

const apiUrl = process.env.SIMULATOR_API_URL ?? "http://localhost:3001/api";
const email = process.env.SIMULATOR_EMAIL ?? "admin@fastmeals.com";
const password = process.env.SIMULATOR_PASSWORD ?? "Admin@123";
const intervalMs = Number(process.env.SIMULATOR_INTERVAL_MS ?? 4_000);

const customers = [
  "Beatriz Lima",
  "Rafael Gomes",
  "Camila Rocha",
  "Lucas Martins",
  "Fernanda Alves",
  "Thiago Ribeiro",
  "Larissa Duarte",
  "Gustavo Pires",
  "Isabela Nunes",
  "Diego Carvalho",
];

// Endereços reais em volta do centro de São Paulo, com as coordenadas aproximadas.
const addresses = [
  { street: "Rua Augusta, 1200 - Consolação", latitude: -23.5559, longitude: -46.6584 },
  { street: "Avenida Paulista, 900 - Bela Vista", latitude: -23.5649, longitude: -46.6527 },
  { street: "Rua Oscar Freire, 500 - Jardins", latitude: -23.5622, longitude: -46.6717 },
  { street: "Rua dos Pinheiros, 800 - Pinheiros", latitude: -23.5662, longitude: -46.6853 },
  { street: "Avenida Ibirapuera, 2000 - Moema", latitude: -23.6012, longitude: -46.6638 },
  { street: "Rua Voluntários da Pátria, 1500 - Santana", latitude: -23.5024, longitude: -46.6252 },
  { street: "Rua Tuiuti, 1000 - Tatuapé", latitude: -23.5401, longitude: -46.5763 },
  { street: "Rua da Consolação, 2300 - Cerqueira César", latitude: -23.5553, longitude: -46.6627 },
];

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)] as T;
const jitter = (value: number) => Number((value + (Math.random() - 0.5) * 0.004).toFixed(6));

let accessToken = "";

async function login() {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login falhou (${response.status}): ${await response.text()}`);
  accessToken = ((await response.json()) as LoginResponse).accessToken;
}

// O access token vence em 15 min; num 401, entra de novo e repete uma vez.
async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const call = () =>
    fetch(`${apiUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(init.body !== undefined && { "content-type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  let response = await call();
  if (response.status === 401) {
    await login();
    response = await call();
  }
  if (!response.ok)
    throw new Error(`${init.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}

async function oldest(status: OrderStatus, limit: number) {
  const list = await api<OrderList>(`/orders?status=${status}&limit=${limit}&sortOrder=asc`);
  return list.data;
}

async function advance(order: Order, status: OrderStatus) {
  await api<Order>(`/orders/${order.id}/status`, { method: "PATCH", body: { status } });
  console.log(`  ${order.customerName}: ${order.status} → ${status}`);
}

async function createOrder(productIds: string[]) {
  const address = pick(addresses);
  const items = [
    ...new Set(Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => pick(productIds))),
  ];
  const order = await api<Order>("/orders", {
    method: "POST",
    body: {
      customerName: pick(customers),
      customerPhone: `(11) 9${String(Math.floor(1000 + Math.random() * 8999))}-${String(Math.floor(1000 + Math.random() * 8999))}`,
      deliveryAddress: address.street,
      latitude: jitter(address.latitude),
      longitude: jitter(address.longitude),
      items: items.map((productId) => ({ productId, quantity: 1 + Math.floor(Math.random() * 2) })),
    },
  });
  console.log(`+ novo pedido de ${order.customerName} (R$ ${order.totalAmount.toFixed(2)})`);
}

async function tick(productIds: string[]) {
  // Mais pedidos chegando do que saindo: a fila cresce e o despacho tem o que fazer.
  if (Math.random() < 0.7) await createOrder(productIds);
  const [pending] = await oldest("pending", 1);
  if (pending && Math.random() < 0.6) await advance(pending, "preparing");
  const [preparing] = await oldest("preparing", 1);
  if (preparing && Math.random() < 0.5) await advance(preparing, "ready");
  const [delivering] = await oldest("delivering", 1);
  if (delivering && Math.random() < 0.4) await advance(delivering, "delivered");
}

let running = true;
process.once("SIGINT", () => {
  running = false;
  console.log("\nsimulador parando…");
});

await login();
const products = await api<ProductList>("/products?isAvailable=true&limit=100");
const productIds = products.data.map((product) => product.id);
if (productIds.length === 0) throw new Error("Nenhum produto disponível: rode o seed antes.");
console.log(`Simulador ligado em ${apiUrl}, um passo a cada ${intervalMs} ms. Ctrl+C para parar.`);

while (running) {
  try {
    await tick(productIds);
  } catch (error) {
    // Uma transição recusada (outro operador mexeu no pedido antes) não para a simulação.
    console.warn(`! ${error instanceof Error ? error.message : String(error)}`);
  }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
