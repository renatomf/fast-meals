import { REALTIME_CLOSE, type ChangeEvent, type RealtimeServerMessage } from "@fastmeals/contracts";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getAccessToken, refreshSession } from "@/services/session";

export type RealtimeStatus = "connecting" | "live" | "offline";

// Cada entidade invalida os caches que dependem dela. Pedido mexe também nos relatórios e
// em entregadores (o pedido atual de cada um).
const affectedKeys: Record<ChangeEvent["entity"], string[][]> = {
  orders: [["orders"], ["reports"], ["delivery-persons"]],
  products: [["products"], ["reports"]],
  delivery_persons: [["delivery-persons"]],
};

const BATCH_MS = 250;
const POLL_MS = 30_000;
const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 30_000;

function socketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

// Agrupa os avisos: o simulador ou uma importação geram dezenas por segundo, e cada cache
// precisa ser recarregado uma vez só.
function createInvalidator(queryClient: QueryClient) {
  const pending = new Set<ChangeEvent["entity"]>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    push(entity: ChangeEvent["entity"]) {
      pending.add(entity);
      timer ??= setTimeout(() => {
        timer = undefined;
        const keys = new Map(
          [...pending].flatMap((item) => affectedKeys[item]).map((key) => [key.join("/"), key]),
        );
        pending.clear();
        for (const key of keys.values()) void queryClient.invalidateQueries({ queryKey: key });
      }, BATCH_MS);
    },
    cancel() {
      clearTimeout(timer);
    },
  };
}

// Tempo real com reserva: conectado, cada mudança no banco recarrega só o que mudou; sem
// conexão (proxy sem WebSocket, servidor reiniciando), as telas abertas recarregam a cada
// 30 s até a conexão voltar.
export function useRealtime(enabled: boolean): RealtimeStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  useEffect(() => {
    if (!enabled) return;
    const invalidator = createInvalidator(queryClient);
    let socket: WebSocket | null = null;
    let retryMs = RETRY_MIN_MS;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let disposed = false;

    function startPolling() {
      setStatus("offline");
      pollTimer ??= setInterval(
        () => void queryClient.invalidateQueries({ refetchType: "active" }),
        POLL_MS,
      );
    }

    function stopPolling() {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }

    function scheduleReconnect() {
      if (disposed || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void connect();
      }, retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    }

    async function connect() {
      if (disposed) return;
      // O token vence em 15 min; se não houver um válido em memória, renova antes.
      let token = getAccessToken();
      if (!token) {
        token = (await refreshSession().catch(() => null))?.accessToken ?? null;
        if (!token) return startPolling();
      }
      const current = new WebSocket(socketUrl());
      socket = current;
      current.addEventListener("open", () => {
        current.send(JSON.stringify({ type: "auth", token }));
      });
      current.addEventListener("message", (message) => {
        const data = JSON.parse(String(message.data)) as RealtimeServerMessage;
        if (data.type === "ready") {
          retryMs = RETRY_MIN_MS;
          stopPolling();
          setStatus("live");
          // O que mudou enquanto estava desconectado também precisa aparecer.
          void queryClient.invalidateQueries({ refetchType: "active" });
        } else {
          invalidator.push(data.event.entity);
        }
      });
      current.addEventListener("close", (event) => {
        if (disposed || socket !== current) return;
        startPolling();
        // Token vencido ou recusado: renova pela API antes de reconectar. A reconexão segue
        // a espera crescente, para um token recusado de novo não virar um laço.
        if (
          event.code === REALTIME_CLOSE.tokenExpired ||
          event.code === REALTIME_CLOSE.unauthorized
        ) {
          void refreshSession()
            .catch(() => null)
            .then((session) => (session ? scheduleReconnect() : undefined));
          return;
        }
        scheduleReconnect();
      });
    }

    // Aba que volta do segundo plano não espera o próximo intervalo de reconexão.
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
        return;
      }
      clearTimeout(retryTimer);
      retryTimer = undefined;
      void connect();
    }

    document.addEventListener("visibilitychange", onVisible);
    void connect();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      invalidator.cancel();
      clearTimeout(retryTimer);
      stopPolling();
      socket?.close();
    };
  }, [enabled, queryClient]);

  return enabled ? status : "offline";
}
