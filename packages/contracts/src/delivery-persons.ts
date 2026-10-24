import { z } from "zod";
import {
  brazilianPhoneSchema,
  latitudeSchema,
  longitudeSchema,
  queryBooleanSchema,
  timestampSchema,
} from "./common.ts";
import { vehicleTypes, vehicleTypeSchema } from "./domain.ts";

const nameMessage = "O nome deve ter entre 3 e 100 caracteres";
const coordinatesMessage = "Envie latitude e longitude juntas, ou as duas nulas";

// Sem defaults: o PUT é parcial (veja products.ts).
const deliveryPersonFields = {
  name: z.string().trim().min(3, nameMessage).max(100, nameMessage),
  phone: brazilianPhoneSchema,
  vehicleType: z.enum(vehicleTypes, `O veículo deve ser ${vehicleTypes.join(", ")}`),
  isActive: z.boolean("Ativo deve ser true ou false"),
  currentLatitude: latitudeSchema.nullable(),
  currentLongitude: longitudeSchema.nullable(),
};

// Localização é o par inteiro ou nada: meia coordenada não serve para calcular distância.
function coordinatesTogether(input: {
  currentLatitude?: number | null;
  currentLongitude?: number | null;
}) {
  return (input.currentLatitude ?? null) === null
    ? (input.currentLongitude ?? null) === null
    : (input.currentLongitude ?? null) !== null;
}

export const createDeliveryPersonSchema = z
  .object({
    ...deliveryPersonFields,
    isActive: deliveryPersonFields.isActive.default(true),
    currentLatitude: deliveryPersonFields.currentLatitude.default(null),
    currentLongitude: deliveryPersonFields.currentLongitude.default(null),
  })
  .refine(coordinatesTogether, { path: ["currentLongitude"], message: coordinatesMessage });
export type CreateDeliveryPersonInput = z.infer<typeof createDeliveryPersonSchema>;

export const updateDeliveryPersonSchema = z
  .object(deliveryPersonFields)
  .partial()
  .refine((input) => Object.keys(input).length > 0, "Envie ao menos um campo para atualizar")
  .refine(
    (input) =>
      "currentLatitude" in input === "currentLongitude" in input && coordinatesTogether(input),
    { path: ["currentLongitude"], message: coordinatesMessage },
  );
export type UpdateDeliveryPersonInput = z.infer<typeof updateDeliveryPersonSchema>;

export const listDeliveryPersonsQuerySchema = z.object({
  isActive: queryBooleanSchema.optional(),
  // true: sem pedido ready ou delivering (premissa 10 do DECISIONS.md).
  available: queryBooleanSchema.optional(),
});
export type ListDeliveryPersonsQuery = z.infer<typeof listDeliveryPersonsQuerySchema>;

export const deliveryPersonSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string(),
  vehicleType: vehicleTypeSchema,
  isActive: z.boolean(),
  currentLatitude: z.number().nullable(),
  currentLongitude: z.number().nullable(),
  currentOrderId: z.uuid().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type DeliveryPerson = z.infer<typeof deliveryPersonSchema>;

export const deliveryPersonListSchema = z.object({ data: z.array(deliveryPersonSchema) });
export type DeliveryPersonList = z.infer<typeof deliveryPersonListSchema>;
