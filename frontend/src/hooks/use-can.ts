import type { UserRole } from "@fastmeals/contracts";
import { useAuth } from "@/context/auth-context";

// Permissões de interface num lugar só. O backend continua sendo a barreira real (403);
// aqui é só para o viewer ver as ações desabilitadas com o motivo, em vez de errar.
const permissions = {
  "orders:write": ["admin"],
  "products:write": ["admin"],
  "delivery-persons:write": ["admin"],
  "dispatch:write": ["admin"],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof permissions;

export const READ_ONLY_MESSAGE = "Somente leitura: seu perfil não permite esta ação";

export function useCan(permission: Permission): boolean {
  const { user } = useAuth();
  return user !== null && (permissions[permission] as readonly UserRole[]).includes(user.role);
}
