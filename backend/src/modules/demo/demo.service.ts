import { EARTH_RADIUS_KM } from "../../algorithms/haversine.ts";
import { AppError } from "../../utils/app-error.ts";
import type { DeliveryPersonsService } from "../delivery-persons/delivery-persons.service.ts";
import type { OrdersService } from "../orders/orders.service.ts";
import type { ProductsService } from "../products/products.service.ts";

// Cenário para mostrar o Húngaro ganhando do guloso. Usa só os services públicos dos
// outros módulos: os dados passam pelas mesmas validações, histórico e travas que os do
// painel, e este módulo não escreve em tabela nenhuma diretamente (ADR 0001).

type DemoServiceOptions = {
  ordersService: OrdersService;
  deliveryPersonsService: DeliveryPersonsService;
  productsService: ProductsService;
};

const DEMO_PREFIX = "[Demo]";

const neighborhoods = [
  { name: "Pinheiros", latitude: -23.5667, longitude: -46.693 },
  { name: "Moema", latitude: -23.6005, longitude: -46.664 },
  { name: "Santana", latitude: -23.502, longitude: -46.625 },
  { name: "Tatuapé", latitude: -23.54, longitude: -46.576 },
];

// A armadilha do guloso numa linha leste–oeste, em km a partir do centro do bairro:
// entregador B em -2,5, pedido 1 em -0,5, entregador A em +0,5, pedido 2 em +2,5.
// O guloso pega o par mais próximo (pedido 1 com A, 1 km) e sobra pedido 2 com B (5 km):
// 6 km. O ótimo cruza: pedido 1 com B e pedido 2 com A, 2 km cada, 4 km no total.
const trap = { deliveryPersons: [-2.5, 0.5], orders: [-0.5, 2.5] };

function eastOf(center: { latitude: number; longitude: number }, km: number) {
  const radiansPerKm = 1 / (EARTH_RADIUS_KM * Math.cos((center.latitude * Math.PI) / 180));
  return {
    latitude: center.latitude,
    longitude: Number((center.longitude + (km * radiansPerKm * 180) / Math.PI).toFixed(6)),
  };
}

export function createDemoService({
  ordersService,
  deliveryPersonsService,
  productsService,
}: DemoServiceOptions) {
  // Cancela os pedidos de demonstração ainda prontos e remove os entregadores livres.
  // Os que alguém já aceitou e está entregando ficam: são operação, não cenário.
  async function clearPreviousScenario(userId: string) {
    const { orders } = await ordersService.list({
      status: "ready",
      page: 1,
      limit: 100,
      sortBy: "createdAt",
      sortOrder: "asc",
    });
    for (const order of orders.filter((item) => item.customerName.startsWith(DEMO_PREFIX))) {
      await ordersService.changeStatus(order.id, "cancelled", userId);
    }
    const people = await deliveryPersonsService.list({});
    for (const person of people.filter((item) => item.name.startsWith(DEMO_PREFIX))) {
      try {
        await deliveryPersonsService.remove(person.id);
      } catch (error) {
        if (!(error instanceof AppError && error.code === "DELIVERY_PERSON_IN_USE")) throw error;
      }
    }
  }

  async function createScenario(userId: string) {
    await clearPreviousScenario(userId);

    const { rows: cheapest } = await productsService.list({
      isAvailable: true,
      page: 1,
      limit: 1,
      sortBy: "price",
      sortOrder: "asc",
    });
    const product = cheapest[0];
    if (!product) {
      throw new AppError(422, "UNAVAILABLE_PRODUCT", "Nenhum produto disponível para o cenário");
    }

    let created = 0;
    for (const neighborhood of neighborhoods) {
      for (const km of trap.deliveryPersons) {
        created++;
        const position = eastOf(neighborhood, km);
        await deliveryPersonsService.create({
          name: `${DEMO_PREFIX} Entregador ${created}`,
          phone: `(11) 90000-${String(created).padStart(4, "0")}`,
          vehicleType: "motorcycle",
          isActive: true,
          currentLatitude: position.latitude,
          currentLongitude: position.longitude,
        });
      }
      for (const km of trap.orders) {
        const side = km > 0 ? "leste" : "oeste";
        const order = await ordersService.create(
          {
            customerName: `${DEMO_PREFIX} Cliente ${neighborhood.name} ${side}`,
            customerPhone: "(11) 98888-0000",
            deliveryAddress: `${neighborhood.name}, ${Math.abs(km)} km a ${side} do centro (demonstração)`,
            ...eastOf(neighborhood, km),
            items: [{ productId: product.id, quantity: 1 }],
          },
          userId,
        );
        await ordersService.changeStatus(order.id, "preparing", userId);
        await ordersService.changeStatus(order.id, "ready", userId);
      }
    }
    return { orders: neighborhoods.length * 2, deliveryPersons: neighborhoods.length * 2 };
  }

  return { createScenario };
}

export type DemoService = ReturnType<typeof createDemoService>;
