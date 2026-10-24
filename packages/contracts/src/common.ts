import { z } from "zod";

export const idParamsSchema = z.object({ id: z.uuid("Identificador inválido") });

export const brazilianPhoneSchema = z
  .string()
  .regex(/^\(\d{2}\) \d{5}-\d{4}$/, "O telefone deve estar no formato (XX) XXXXX-XXXX");

export const latitudeSchema = z
  .number("A latitude deve ser um número")
  .min(-90, "A latitude deve estar entre -90 e 90")
  .max(90, "A latitude deve estar entre -90 e 90");

export const longitudeSchema = z
  .number("A longitude deve ser um número")
  .min(-180, "A longitude deve estar entre -180 e 180")
  .max(180, "A longitude deve estar entre -180 e 180");

// DECIMAL(10,2): positivo, no máximo 2 casas e 8 dígitos inteiros.
export const moneySchema = z
  .number("O valor deve ser um número")
  .max(99_999_999.99, "O valor máximo é 99.999.999,99")
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    "O valor deve ter no máximo 2 casas decimais",
  );

export const isoDateSchema = z.iso.date("Use o formato YYYY-MM-DD");

// Query strings chegam como texto: "false" vira false, e não true como no z.coerce.boolean().
export const queryBooleanSchema = z.stringbool({ error: 'Use "true" ou "false"' });

export const timestampSchema = z.iso.datetime({ offset: true });
