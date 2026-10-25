import type { ChangeFeed } from "../realtime/change-feed.ts";
import type { ReportsService } from "./reports.service.ts";

type CacheOptions = {
  changeFeed: ChangeFeed;
  // Rede de segurança: se um aviso se perder enquanto a conexão de LISTEN reconecta, o
  // valor velho dura no máximo isto. É o mesmo intervalo do polling de reserva do front.
  ttlMs?: number;
  // Períodos arbitrários geram chaves sem fim; acima do limite saem as mais antigas.
  maxEntries?: number;
  now?: () => number;
};

type Entry = { value: Promise<unknown>; expiresAt: number };

// Cache em memória dos relatórios, limpo a cada mudança confirmada no banco (o mesmo aviso
// do tempo real, ADR 0005). Com o painel ao vivo, cada mudança faz todos os dashboards
// abertos pedirem os mesmos relatórios ao mesmo tempo: o primeiro calcula, os outros
// recebem pronto. Guarda a promessa, não o valor, então pedidos simultâneos iguais
// também viram uma consulta só.
export function createReportsCache(
  service: ReportsService,
  { changeFeed, ttlMs = 30_000, maxEntries = 500, now = Date.now }: CacheOptions,
): ReportsService & { readonly size: number } {
  const entries = new Map<string, Entry>();

  // Uma consulta em andamento durante uma mudança também sai do mapa: quando ela termina,
  // o resultado (de antes da mudança) já não está guardado, e o próximo pedido recalcula.
  changeFeed.subscribe(() => entries.clear());

  function cached<Query extends object, Result>(
    name: string,
    compute: (query: Query) => Promise<Result>,
  ): (query: Query) => Promise<Result> {
    return (query) => {
      const key = `${name}:${JSON.stringify(query, Object.keys(query).sort())}`;
      const hit = entries.get(key);
      if (hit && hit.expiresAt > now()) return hit.value as Promise<Result>;

      const value = compute(query);
      entries.delete(key);
      entries.set(key, { value, expiresAt: now() + ttlMs });
      if (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      // Erro não fica guardado: o próximo pedido tenta de novo.
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key);
      });
      return value;
    };
  }

  return {
    revenue: cached("revenue", service.revenue),
    ordersByStatus: cached("orders-by-status", service.ordersByStatus),
    topProducts: cached("top-products", service.topProducts),
    averageDeliveryTime: cached("average-delivery-time", service.averageDeliveryTime),
    get size() {
      return entries.size;
    },
  };
}
