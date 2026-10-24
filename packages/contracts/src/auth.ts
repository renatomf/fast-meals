import { z } from "zod";
import { userRoleSchema } from "./domain.ts";

export const loginRequestSchema = z.object({
  email: z.email("Informe um email válido").max(255).toLowerCase(),
  // O bcrypt ignora o que passa de 72 bytes; aceitar mais só gastaria CPU.
  password: z.string().min(1, "Informe a senha").max(72),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: userRoleSchema,
});
export type AuthUser = z.infer<typeof authUserSchema>;

// O refreshToken vem no corpo, como no api-spec, e também num cookie httpOnly.
// O front usa só o cookie; o corpo atende clientes de API (Swagger, curl, testes).
export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: authUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

// Sem refreshToken no corpo, o servidor usa o cookie.
export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

// O spec devolve só os tokens; o user a mais deixa o front restaurar a sessão
// depois de um F5 sem uma segunda chamada.
export const refreshResponseSchema = loginResponseSchema;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
