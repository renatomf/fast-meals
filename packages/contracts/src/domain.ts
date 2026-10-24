import { z } from "zod";

// Fonte única dos valores de domínio: os schemas da API, as CHECK constraints do banco
// e os componentes do front leem daqui.

export const userRoles = ["admin", "viewer"] as const;
export const userRoleSchema = z.enum(userRoles);
export type UserRole = z.infer<typeof userRoleSchema>;

export const productCategories = ["meal", "drink", "dessert", "side"] as const;
export const productCategorySchema = z.enum(productCategories);
export type ProductCategory = z.infer<typeof productCategorySchema>;

export const orderStatuses = [
  "pending",
  "preparing",
  "ready",
  "delivering",
  "delivered",
  "cancelled",
] as const;
export const orderStatusSchema = z.enum(orderStatuses);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const vehicleTypes = ["bicycle", "motorcycle", "car"] as const;
export const vehicleTypeSchema = z.enum(vehicleTypes);
export type VehicleType = z.infer<typeof vehicleTypeSchema>;
