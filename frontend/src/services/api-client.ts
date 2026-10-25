import type { ErrorCode, ErrorResponse } from "@fastmeals/contracts";
import { getAccessToken, notifySessionExpired, refreshSession } from "@/services/session";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | "NETWORK_ERROR";
  readonly details: Record<string, unknown>[];

  constructor(
    status: number,
    code: ErrorCode | "NETWORK_ERROR",
    message: string,
    details: Record<string, unknown>[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

async function send(path: string, { method = "GET", body, signal }: RequestOptions) {
  const token = getAccessToken();
  try {
    return await fetch(`/api${path}`, {
      method,
      signal,
      credentials: "same-origin",
      headers: {
        ...(body !== undefined && { "content-type": "application/json" }),
        ...(token && { authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, "NETWORK_ERROR", "Sem conexão com o servidor. Tente novamente.");
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const { error } = (await response.json()) as ErrorResponse;
    return new ApiError(response.status, error.code, error.message, error.details);
  } catch {
    return new ApiError(response.status, "INTERNAL_ERROR", "Erro inesperado do servidor.");
  }
}

// Um 401 numa rota autenticada é access token vencido (15 min): renova pelo cookie e
// repete a requisição uma vez. Se a renovação falhar, a sessão acabou de verdade.
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);
  if (response.status === 401 && getAccessToken() !== null) {
    let renewed;
    try {
      renewed = await refreshSession();
    } catch {
      // Renovação indisponível agora (limite, servidor fora): a requisição falha, mas a
      // sessão não é dada como encerrada.
      throw await toApiError(response);
    }
    if (!renewed) {
      notifySessionExpired();
      throw await toApiError(response);
    }
    response = await send(path, options);
  }
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function toQueryString(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
