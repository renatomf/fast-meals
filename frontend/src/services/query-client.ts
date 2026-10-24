import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/services/api-client";

// Erro 4xx é resposta definitiva (validação, permissão, não encontrado): repetir não
// muda nada. Só falha de rede e 5xx merecem nova tentativa.
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 15_000 },
      mutations: { retry: false },
    },
  });
}
