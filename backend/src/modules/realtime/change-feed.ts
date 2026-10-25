import { changeEventSchema, type ChangeEvent } from "@fastmeals/contracts";
import type { FastifyBaseLogger } from "fastify";
import pg from "pg";

export const CHANGES_CHANNEL = "fastmeals_changes";

type Listener = (event: ChangeEvent) => void;

// O que a rota WebSocket precisa saber: assinar e cancelar. Os testes usam um feed falso.
export type ChangeFeed = { subscribe: (listener: Listener) => () => void };

export function createChangeHub() {
  const listeners = new Set<Listener>();
  return {
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish(event: ChangeEvent) {
      for (const listener of listeners) listener(event);
    },
    get size() {
      return listeners.size;
    },
  };
}

const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 30_000;

// LISTEN precisa de uma conexão só dele, fora do pool: uma conexão do pool volta para
// outros usos e perderia a inscrição. Se o banco cair, reconecta com espera crescente;
// enquanto isso o front segue com o polling de reserva.
export function createPostgresChangeFeed(connectionString: string) {
  const hub = createChangeHub();
  let log: FastifyBaseLogger | undefined;
  let client: pg.Client | null = null;
  let retryMs = RETRY_MIN_MS;
  let retryTimer: NodeJS.Timeout | undefined;
  let stopped = false;

  function scheduleReconnect() {
    if (stopped || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void connect();
    }, retryMs);
    retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
  }

  async function connect() {
    const next = new pg.Client({ connectionString });
    next.on("notification", (message) => {
      if (message.channel !== CHANGES_CHANNEL || !message.payload) return;
      const parsed = changeEventSchema.safeParse(JSON.parse(message.payload));
      if (parsed.success) hub.publish(parsed.data);
      else log?.warn({ payload: message.payload }, "unexpected change notification");
    });
    next.on("error", (error) => {
      log?.error({ err: error }, "change feed connection failed");
      void next.end().catch(() => {});
    });
    // Com ou sem erro (um restart do banco encerra a conexão "limpa"), conexão encerrada
    // fora do stop() é reconectada.
    next.on("end", () => {
      if (client === next) client = null;
      scheduleReconnect();
    });
    try {
      await next.connect();
      await next.query(`LISTEN ${CHANGES_CHANNEL}`);
      if (stopped) {
        await next.end();
        return;
      }
      client = next;
      retryMs = RETRY_MIN_MS;
      log?.info("change feed listening");
    } catch (error) {
      log?.error({ err: error }, "change feed could not connect");
      await next.end().catch(() => {});
      scheduleReconnect();
    }
  }

  return {
    subscribe: hub.subscribe,
    start(logger: FastifyBaseLogger) {
      log = logger;
      return connect();
    },
    async stop() {
      stopped = true;
      clearTimeout(retryTimer);
      await client?.end();
    },
  };
}
