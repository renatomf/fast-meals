import type {
  AverageDeliveryTimeReport,
  OrdersByStatusReport,
  RevenueReport,
  TopProductsReport,
} from "@fastmeals/contracts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { statusMeta } from "@/features/orders";
import {
  formatDecimal,
  formatInteger,
  formatMinutes,
  formatMoney,
  formatShortDate,
} from "@/utils/format";
import { vehicleLabels } from "@/utils/labels";

const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 };

function ChartTooltip({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-muted-foreground tabular-nums">
          {line}
        </p>
      ))}
    </div>
  );
}

type Day = RevenueReport["dailyRevenue"][number];

// Uma barra por dia; o valor exato fica no tooltip. Os dias sem venda aparecem como zero
// (a API preenche com generate_series), então lacunas no gráfico são dias parados de fato.
export function DailyRevenueChart({ report }: { report: RevenueReport }) {
  const best = report.dailyRevenue.reduce<Day | undefined>(
    (top, day) => (!top || day.revenue > top.revenue ? day : top),
    undefined,
  );
  return (
    <div
      className="h-72"
      role="img"
      aria-label={`Receita diária de ${formatShortDate(report.startDate)} a ${formatShortDate(report.endDate)}. ${
        best && best.revenue > 0
          ? `Melhor dia: ${formatShortDate(best.date)}, com ${formatMoney(best.revenue)}.`
          : "Sem receita no período."
      }`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={report.dailyRevenue} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tick={axisTick}
          />
          <YAxis
            tickFormatter={(value: number) => formatMoney(value).replace(/,00$/, "")}
            tickLine={false}
            axisLine={false}
            width={80}
            tick={axisTick}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload }) => {
              const day = payload?.[0]?.payload as Day | undefined;
              if (!active || !day) return null;
              return (
                <ChartTooltip
                  title={formatShortDate(day.date)}
                  lines={[
                    formatMoney(day.revenue),
                    `${formatInteger(day.orders)} ${day.orders === 1 ? "pedido" : "pedidos"}`,
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="revenue"
            fill="var(--chart-1)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Rosca com as cores de status dos badges; a legenda abaixo traz número e percentual, e é
// ela que o leitor de tela lê (o desenho fica escondido dele).
export function OrdersByStatusChart({ report }: { report: OrdersByStatusReport }) {
  const rows = report.data.filter((row) => row.count > 0);
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative size-44 shrink-0" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          {/* Decorativo e fora da árvore de acessibilidade: não pode receber foco. */}
          <PieChart accessibilityLayer={false}>
            <Pie
              rootTabIndex={-1}
              data={rows}
              dataKey="count"
              nameKey="status"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={rows.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {rows.map((row) => (
                <Cell key={row.status} fill={`var(--status-${row.status})`} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center text-center">
          <span>
            <span className="block text-xl font-bold tabular-nums">
              {formatInteger(report.total)}
            </span>
            <span className="text-xs text-muted-foreground">pedidos</span>
          </span>
        </div>
      </div>
      <ul
        className="grid w-full grid-cols-[1fr_auto_auto] gap-x-4 gap-y-2"
        aria-label="Pedidos por status"
      >
        {report.data.map((row) => (
          <li key={row.status} className="col-span-3 grid grid-cols-subgrid items-center text-ui">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span
                className={`size-2.5 shrink-0 rounded-full ${statusMeta[row.status].dot}`}
                aria-hidden="true"
              />
              {statusMeta[row.status].label}
            </span>
            <span className="text-right tabular-nums">{formatInteger(row.count)}</span>
            <span className="text-right text-muted-foreground tabular-nums">
              {report.total > 0 ? `${formatDecimal((row.count / report.total) * 100)}%` : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DeliveryTimeByVehicleChart({ report }: { report: AverageDeliveryTimeReport }) {
  const data = report.byVehicleType.map((row) => ({
    ...row,
    label: vehicleLabels[row.vehicleType],
  }));
  return (
    <div
      className="h-56"
      role="img"
      aria-label={`Tempo médio de entrega por veículo: ${data
        .map((row) => `${row.label}, ${formatMinutes(row.averageMinutes)}`)
        .join("; ")}.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            tickFormatter={(value: number) => `${formatInteger(value)} min`}
            tickLine={false}
            axisLine={false}
            tick={axisTick}
          />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={false}
            width={80}
            tick={axisTick}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!active || !row) return null;
              return (
                <ChartTooltip
                  title={row.label}
                  lines={[
                    `${formatMinutes(row.averageMinutes)} em média`,
                    `${formatInteger(row.count)} entregas`,
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="averageMinutes"
            fill="var(--chart-2)"
            radius={[0, 3, 3, 0]}
            barSize={22}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Ranking em HTML: nome, quantidade e receita legíveis, com a barra só como apoio visual.
// A API ordena por unidades vendidas, então a barra mede unidades: a ordem e o tamanho
// das barras contam a mesma história.
export function TopProductsList({ report }: { report: TopProductsReport }) {
  const largest = Math.max(...report.data.map((row) => row.totalQuantity), 1);
  return (
    <ol className="flex flex-col gap-3">
      {report.data.map((row, index) => (
        <li key={row.productId} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-ui">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span className="truncate font-medium">{row.productName}</span>
            </span>
            <span className="shrink-0 tabular-nums">
              {formatInteger(row.totalQuantity)} un.
              <span className="ml-2 text-xs text-muted-foreground">
                {formatMoney(row.totalRevenue)}
              </span>
            </span>
          </div>
          <div className="ml-7 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-full rounded-full bg-chart-1"
              style={{ width: `${(row.totalQuantity / largest) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
