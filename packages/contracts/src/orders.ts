import { z } from "zod";
import {
  brazilianPhoneSchema,
  isoDateSchema,
  latitudeSchema,
  longitudeSchema,
  timestampSchema,
} from "./common.ts";
import { orderStatusSchema, vehicleTypeSchema, type OrderStatus } from "./domain.ts";
import { paginatedSchema, paginationQuerySchema, sortOrderSchema } from "./pagination.ts";

// As 7 transições do enunciado; qualquer outra é recusada. O back valida por esta tabela
// e o front deriva dela os botões de ação, então os dois nunca divergem.
export const orderTransitions = {
  pending: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivering", "cancelled"],
  delivering: ["delivered"],
  delivered: [],
  cancelled: [],
} as const satisfies Record<OrderStatus, readonly OrderStatus[]>;

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (orderTransitions[from] as readonly OrderStatus[]).includes(to);
}

const customerNameMessage = "O nome do cliente deve ter entre 3 e 100 caracteres";
const addressMessage = "O endereço deve ter entre 10 e 300 caracteres";
const quantityMessage = "A quantidade deve ser um inteiro entre 1 e 99";

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(3, customerNameMessage).max(100, customerNameMessage),
  customerPhone: brazilianPhoneSchema,
  deliveryAddress: z.string().trim().min(10, addressMessage).max(300, addressMessage),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  items: z
    .array(
      z.object({
        productId: z.uuid("Produto inválido"),
        quantity: z
          .number(quantityMessage)
          .int(quantityMessage)
          .min(1, quantityMessage)
          .max(99, quantityMessage),
      }),
      "Informe os itens do pedido",
    )
    .min(1, "O pedido precisa de ao menos um item")
    .max(50, "O pedido pode ter no máximo 50 itens")
    .refine(
      (items) => new Set(items.map((item) => item.productId)).size === items.length,
      "Cada produto deve aparecer uma vez; use a quantidade para repetir",
    ),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({ status: orderStatusSchema });
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export const assignDeliveryPersonSchema = z.object({
  deliveryPersonId: z.uuid("Entregador inválido"),
});
export type AssignDeliveryPersonInput = z.infer<typeof assignDeliveryPersonSchema>;

export const orderSortFields = ["createdAt", "totalAmount"] as const;

export const listOrdersQuerySchema = paginationQuerySchema
  .extend({
    status: orderStatusSchema.optional(),
    // Dias no fuso de São Paulo, inclusive nas duas pontas.
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    sortBy: z.enum(orderSortFields).default("createdAt"),
    sortOrder: sortOrderSchema,
  })
  .refine((query) => !query.startDate || !query.endDate || query.startDate <= query.endDate, {
    path: ["endDate"],
    message: "A data final deve ser igual ou posterior à inicial",
  });
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export const orderSchema = z.object({
  id: z.uuid(),
  customerName: z.string(),
  customerPhone: z.string(),
  deliveryAddress: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  status: orderStatusSchema,
  totalAmount: z.number(),
  deliveryPerson: z
    .object({
      id: z.uuid(),
      name: z.string(),
      phone: z.string(),
      vehicleType: vehicleTypeSchema,
    })
    .nullable(),
  items: z.array(
    z.object({
      id: z.uuid(),
      product: z.object({ id: z.uuid(), name: z.string() }),
      quantity: z.number().int(),
      unitPrice: z.number(),
    }),
  ),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Order = z.infer<typeof orderSchema>;

export const orderListSchema = paginatedSchema(orderSchema);
export type OrderList = z.infer<typeof orderListSchema>;

export const orderHistorySchema = z.object({
  data: z.array(
    z.object({
      id: z.uuid(),
      fromStatus: orderStatusSchema.nullable(),
      toStatus: orderStatusSchema,
      changedAt: timestampSchema,
      changedBy: z.object({ id: z.uuid(), email: z.string() }).nullable(),
    }),
  ),
});
export type OrderHistory = z.infer<typeof orderHistorySchema>;
