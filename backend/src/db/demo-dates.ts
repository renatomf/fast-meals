import { sql, type SQL } from "drizzle-orm";
import type { Database, Transaction } from "./client.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const CHANGES_CHANNEL = "fastmeals_changes";

// Os pedidos do seed ficam com as datas do dia em que ele rodou; numa demo que fica no ar,
// cada dia sem atualização vira um buraco no fim dos gráficos. Isto traz o histórico de
// volta para perto de hoje, em dias inteiros (o horário de cada pedido não muda).
//
// Encerrados e em andamento andam separados: o volume histórico termina antes dos pedidos
// "acontecendo agora", e um deslocamento único deixaria um dos dois grupos para trás.
const groups = [
  { name: "closed", statuses: sql`('delivered', 'cancelled')` },
  { name: "active", statuses: sql`('pending', 'preparing', 'ready', 'delivering')` },
] as const;

export type DemoShift = Record<(typeof groups)[number]["name"], number>;

// A referência de cada grupo é o último dia com volume normal (ao menos um quarto do dia
// mais movimentado), não o pedido mais recente: um pedido avulso entregue hoje por quem testa a demo
// não pode segurar o histórico inteiro. A medida é o fim da atividade desse dia.
async function anchorOf(tx: Transaction, statuses: SQL): Promise<Date | null> {
  const { rows } = await tx.execute<{ anchor: string | null }>(sql`
    with activity as (
      select greatest(created_at, updated_at) as at,
        (created_at at time zone 'America/Sao_Paulo')::date as day
      from orders where status in ${statuses}
    ),
    daily as (select day, count(*) as orders from activity group by day),
    busiest as (
      select max(day) as day from daily
      where orders >= (select max(orders) from daily) / 4.0
    )
    select max(activity.at)::text as anchor
    from activity join busiest on activity.day = busiest.day`);
  const anchor = rows[0]?.anchor;
  return anchor ? new Date(anchor) : null;
}

export async function shiftDemoHistory(db: Database, now: Date = new Date()): Promise<DemoShift> {
  return db.transaction(async (tx) => {
    const shift: DemoShift = { closed: 0, active: 0 };
    for (const group of groups) {
      const anchor = await anchorOf(tx, group.statuses);
      if (anchor) {
        shift[group.name] = Math.max(Math.floor((now.getTime() - anchor.getTime()) / DAY_MS), 0);
      }
    }
    if (shift.closed === 0 && shift.active === 0) return shift;

    // O updated_at é deslocado junto, não carimbado com agora; e um aviso por linha
    // mandaria milhares de eventos ao painel: os gatilhos ficam desligados só dentro desta
    // transação (num erro, o rollback os religa) e sai um aviso só no fim.
    await tx.execute(sql`alter table orders disable trigger trg_orders_updated_at`);
    await tx.execute(sql`alter table orders disable trigger trg_orders_notify`);
    const at = now.toISOString();
    for (const group of groups) {
      const days = shift[group.name];
      if (days === 0) continue;
      // Nenhum pedido vai para o futuro: o que acabou de acontecer fica onde está.
      const movable = sql`o.status in ${group.statuses}
        and greatest(o.created_at, o.updated_at) + ${days} * interval '1 day' <= ${at}::timestamptz`;
      await tx.execute(sql`
        update order_status_history h set changed_at = h.changed_at + ${days} * interval '1 day'
        from orders o where o.id = h.order_id and ${movable}`);
      await tx.execute(sql`
        update orders o set
          created_at = o.created_at + ${days} * interval '1 day',
          updated_at = o.updated_at + ${days} * interval '1 day'
        where ${movable}`);
    }
    await tx.execute(sql`alter table orders enable trigger trg_orders_updated_at`);
    await tx.execute(sql`alter table orders enable trigger trg_orders_notify`);

    // Painéis abertos refazem as consultas, e a API descarta o cache dos relatórios.
    await tx.execute(sql`
      select pg_notify(${CHANGES_CHANNEL}, json_build_object(
        'entity', 'orders', 'op', 'update', 'id', id, 'status', status)::text)
      from orders order by created_at desc limit 1`);
    return shift;
  });
}
