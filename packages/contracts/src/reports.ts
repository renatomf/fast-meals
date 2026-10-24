import { z } from "zod";
import { isoDateSchema } from "./common.ts";
import { orderStatusSchema, vehicleTypeSchema } from "./domain.ts";

// O período de todos os relatórios é a data de criação do pedido, em dias de São Paulo,
// com as duas pontas incluídas: o mesmo critério do filtro da listagem de pedidos.
export const MAX_REPORT_DAYS = 366;

type Period = { startDate?: string | undefined; endDate?: string | undefined };

const dayCount = (startDate: string, endDate: string) =>
  (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 + 1;

function periodRules<Schema extends z.ZodType<Period>>(schema: Schema) {
  return schema
    .refine(
      (period) => !period.startDate || !period.endDate || period.startDate <= period.endDate,
      {
        path: ["endDate"],
        message: "A data final deve ser igual ou posterior à inicial",
      },
    )
    .refine(
      (period) =>
        !period.startDate ||
        !period.endDate ||
        dayCount(period.startDate, period.endDate) <= MAX_REPORT_DAYS,
      { path: ["endDate"], message: `O período pode ter no máximo ${MAX_REPORT_DAYS} dias` },
    );
}

const optionalPeriod = { startDate: isoDateSchema.optional(), endDate: isoDateSchema.optional() };

export const revenueQuerySchema = periodRules(
  z.object({ startDate: isoDateSchema, endDate: isoDateSchema }),
);
export type RevenueQuery = z.infer<typeof revenueQuerySchema>;

export const revenueReportSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  totalRevenue: z.number(),
  totalOrders: z.number().int(),
  averageOrderValue: z.number(),
  dailyRevenue: z.array(
    z.object({ date: z.string(), revenue: z.number(), orders: z.number().int() }),
  ),
});
export type RevenueReport = z.infer<typeof revenueReportSchema>;

export const periodQuerySchema = periodRules(z.object(optionalPeriod));
export type PeriodQuery = z.infer<typeof periodQuerySchema>;

export const ordersByStatusReportSchema = z.object({
  data: z.array(z.object({ status: orderStatusSchema, count: z.number().int() })),
  total: z.number().int(),
});
export type OrdersByStatusReport = z.infer<typeof ordersByStatusReportSchema>;

export const topProductsQuerySchema = periodRules(
  z.object({
    ...optionalPeriod,
    limit: z.coerce.number().int().min(1).max(50, "O limite máximo é 50 produtos").default(10),
  }),
);
export type TopProductsQuery = z.infer<typeof topProductsQuerySchema>;

export const topProductsReportSchema = z.object({
  data: z.array(
    z.object({
      productId: z.uuid(),
      productName: z.string(),
      totalQuantity: z.number().int(),
      totalRevenue: z.number(),
    }),
  ),
});
export type TopProductsReport = z.infer<typeof topProductsReportSchema>;

export const averageDeliveryTimeReportSchema = z.object({
  averageMinutes: z.number(),
  fastestMinutes: z.number(),
  slowestMinutes: z.number(),
  totalDelivered: z.number().int(),
  byVehicleType: z.array(
    z.object({
      vehicleType: vehicleTypeSchema,
      averageMinutes: z.number(),
      count: z.number().int(),
    }),
  ),
});
export type AverageDeliveryTimeReport = z.infer<typeof averageDeliveryTimeReportSchema>;
