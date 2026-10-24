import type { AuthUser, LoginResponse, Order, OrderList } from "@fastmeals/contracts";

export const adminUser: AuthUser = {
  id: "0190a0b0-0000-7000-8000-000000000001",
  email: "admin@fastmeals.com",
  role: "admin",
};

export const viewerUser: AuthUser = {
  id: "0190a0b0-0000-7000-8000-000000000002",
  email: "viewer@fastmeals.com",
  role: "viewer",
};

export function sessionFor(user: AuthUser): LoginResponse {
  return { accessToken: `access-${user.role}`, refreshToken: "refresh", user };
}

export function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "0190a0b0-0000-7000-8000-0000000000aa",
    customerName: "Ana Souza",
    customerPhone: "11999990000",
    deliveryAddress: "Rua Augusta, 1500 - Consolação",
    latitude: -23.5558,
    longitude: -46.6622,
    status: "pending",
    totalAmount: 59.8,
    deliveryPerson: null,
    items: [
      {
        id: "0190a0b0-0000-7000-8000-0000000000b1",
        product: { id: "0190a0b0-0000-7000-8000-0000000000c1", name: "X-Burger" },
        quantity: 2,
        unitPrice: 29.9,
      },
    ],
    createdAt: "2026-10-24T12:00:00.000Z",
    updatedAt: "2026-10-24T12:00:00.000Z",
    ...overrides,
  };
}

export function listOf(orders: Order[]): OrderList {
  return {
    data: orders,
    pagination: { page: 1, limit: 20, total: orders.length, totalPages: 1 },
  };
}
