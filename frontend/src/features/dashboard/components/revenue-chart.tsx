import type { RevenueReport } from "@fastmeals/contracts";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatShortDate } from "@/utils/format";

type RevenueChartProps = { daily: RevenueReport["dailyRevenue"] };

function RevenueTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: RevenueReport["dailyRevenue"][number] }[];
}) {
  const day = payload?.[0]?.payload;
  if (!active || !day) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">{formatShortDate(day.date)}</p>
      <p className="tabular-nums">{formatMoney(day.revenue)}</p>
      <p className="text-muted-foreground tabular-nums">
        {day.orders} {day.orders === 1 ? "pedido entregue" : "pedidos entregues"}
      </p>
    </div>
  );
}

// Uma série, uma cor (a da marca); o valor exato fica no tooltip (padrão Stripe Reports).
// As cores vêm dos tokens por var(), então o gráfico acompanha o tema sem re-render.
export function RevenueChart({ daily }: RevenueChartProps) {
  return (
    <div className="h-64" role="img" aria-label="Gráfico de receita diária do período">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(value: number) => formatMoney(value).replace(/,00$/, "")}
            tickLine={false}
            axisLine={false}
            width={80}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip content={<RevenueTooltip />} cursor={{ stroke: "var(--border)" }} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#revenue-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
