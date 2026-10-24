import type {
  AssignDeliveryPersonInput,
  CreateOrderInput,
  ListOrdersQuery,
  Order,
  OrderHistory,
  OrderList,
  UpdateOrderStatusInput,
} from "@fastmeals/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { paginationMeta } from "../../utils/pagination.ts";
import type { OrderRecord, OrdersService } from "./orders.service.ts";

type ById = { Params: { id: string } };

function toOrderResponse(order: OrderRecord): Order {
  return {
    id: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    latitude: order.latitude,
    longitude: order.longitude,
    status: order.status,
    totalAmount: Number(order.totalAmount),
    deliveryPerson: order.deliveryPerson,
    items: order.items.map((item) => ({
      id: item.id,
      product: item.product,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

// Só roda atrás do authenticate; sem usuário é erro de montagem de rota, não do cliente.
function requestUserId(request: FastifyRequest): string {
  if (!request.user) throw new Error("orders routes must run after authenticate");
  return request.user.id;
}

export function createOrdersController(ordersService: OrdersService) {
  return {
    async list(request: FastifyRequest<{ Querystring: ListOrdersQuery }>): Promise<OrderList> {
      const { orders, total } = await ordersService.list(request.query);
      return {
        data: orders.map(toOrderResponse),
        pagination: paginationMeta(request.query, total),
      };
    },

    async get(request: FastifyRequest<ById>): Promise<Order> {
      return toOrderResponse(await ordersService.get(request.params.id));
    },

    async history(request: FastifyRequest<ById>): Promise<OrderHistory> {
      const entries = await ordersService.history(request.params.id);
      return {
        data: entries.map((entry) => ({ ...entry, changedAt: entry.changedAt.toISOString() })),
      };
    },

    async create(
      request: FastifyRequest<{ Body: CreateOrderInput }>,
      reply: FastifyReply,
    ): Promise<Order> {
      const order = await ordersService.create(request.body, requestUserId(request));
      reply.status(201);
      return toOrderResponse(order);
    },

    async changeStatus(
      request: FastifyRequest<ById & { Body: UpdateOrderStatusInput }>,
    ): Promise<Order> {
      return toOrderResponse(
        await ordersService.changeStatus(
          request.params.id,
          request.body.status,
          requestUserId(request),
        ),
      );
    },

    async assign(
      request: FastifyRequest<ById & { Body: AssignDeliveryPersonInput }>,
    ): Promise<Order> {
      return toOrderResponse(
        await ordersService.assign(request.params.id, request.body.deliveryPersonId),
      );
    },
  };
}
