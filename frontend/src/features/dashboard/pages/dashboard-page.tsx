import { useNavigate, useSearch } from "@tanstack/react-router";
import { ErrorState } from "@/design-system/components/error-state";
import { MetricCard } from "@/design-system/components/metric-card";
import { PageHeader } from "@/design-system/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/design-system/ui/card";
import { Skeleton } from "@/design-system/ui/skeleton";
import { useOrders } from "@/features/orders";
import { cn } from "@/utils/cn";
import { formatInteger, formatMinutes, formatMoney, formatShortDate } from "@/utils/format";
import { AttentionList } from "../components/attention-list";
import { RevenueChart } from "../components/revenue-chart";
import { StatusBreakdown } from "../components/status-breakdown";
import { useDashboard } from "../hooks/use-dashboard";
import { periodDays, type DashboardPeriod } from "../search-params";

const periods: { value: DashboardPeriod; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
];

type Comparison = { hint: string; tone: "positive" | "negative" | "neutral" } | undefined;

// Variação contra o período anterior. "lowerIsBetter" inverte a cor (tempo de entrega).
function compare(
  current: number | undefined,
  previous: number | undefined,
  lowerIsBetter = false,
): Comparison {
  if (current === undefined || previous === undefined) return undefined;
  if (previous === 0) return { hint: "Sem dados no período anterior", tone: "neutral" };
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.0005) return { hint: "Igual ao período anterior", tone: "neutral" };
  const improved = lowerIsBetter ? change < 0 : change > 0;
  const sign = change > 0 ? "+" : "−";
  return {
    hint: `${sign}${Math.abs(change * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. período anterior`,
    tone: improved ? "positive" : "negative",
  };
}

export function DashboardPage() {
  const search = useSearch({ from: "/app/" });
  const navigate = useNavigate({ from: "/" });
  const period = search.period ?? "30d";
  const { range, revenue, previousRevenue, ordersByStatus, deliveryTime, previousDeliveryTime } =
    useDashboard(periodDays[period]);
  const readyOrders = useOrders({ status: "ready", limit: 5, sortOrder: "asc" });
  const pendingOrders = useOrders({ status: "pending", limit: 5, sortOrder: "asc" });

  const revenueComparison = compare(revenue.data?.totalRevenue, previousRevenue.data?.totalRevenue);
  const ordersComparison = compare(revenue.data?.totalOrders, previousRevenue.data?.totalOrders);
  const ticketComparison = compare(
    revenue.data?.averageOrderValue,
    previousRevenue.data?.averageOrderValue,
  );
  const deliveryComparison = compare(
    deliveryTime.data?.averageMinutes,
    previousDeliveryTime.data?.averageMinutes,
    true,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Visão geral"
        description={`${formatShortDate(range.startDate)} a ${formatShortDate(range.endDate)}`}
        actions={
          <div
            role="radiogroup"
            aria-label="Período"
            className="flex rounded-md border bg-background p-0.5"
          >
            {periods.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={period === option.value}
                onClick={() => void navigate({ search: { period: option.value } })}
                className={cn(
                  "h-7 rounded-[5px] px-3 text-ui font-medium transition-colors duration-150",
                  period === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Receita"
          value={revenue.data && formatMoney(revenue.data.totalRevenue)}
          hint={revenueComparison?.hint}
          tone={revenueComparison?.tone}
          loading={revenue.isLoading}
        />
        <MetricCard
          label="Pedidos entregues"
          value={revenue.data && formatInteger(revenue.data.totalOrders)}
          hint={ordersComparison?.hint}
          tone={ordersComparison?.tone}
          loading={revenue.isLoading}
        />
        <MetricCard
          label="Ticket médio"
          value={revenue.data && formatMoney(revenue.data.averageOrderValue)}
          hint={ticketComparison?.hint}
          tone={ticketComparison?.tone}
          loading={revenue.isLoading}
        />
        <MetricCard
          label="Tempo médio de entrega"
          value={
            deliveryTime.data &&
            (deliveryTime.data.totalDelivered === 0
              ? "—"
              : formatMinutes(deliveryTime.data.averageMinutes))
          }
          hint={deliveryComparison?.hint}
          tone={deliveryComparison?.tone}
          loading={deliveryTime.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Receita diária</CardTitle>
              <CardDescription>Pedidos entregues, pela data em que foram feitos</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {revenue.isError ? (
              <ErrorState message={revenue.error.message} onRetry={() => void revenue.refetch()} />
            ) : revenue.data ? (
              <RevenueChart daily={revenue.data.dailyRevenue} />
            ) : (
              <Skeleton className="h-64" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Pedidos por status</CardTitle>
              <CardDescription>
                {ordersByStatus.data
                  ? `${formatInteger(ordersByStatus.data.total)} no período`
                  : " "}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {ordersByStatus.isError ? (
              <ErrorState
                message={ordersByStatus.error.message}
                onRetry={() => void ordersByStatus.refetch()}
              />
            ) : ordersByStatus.data ? (
              <StatusBreakdown report={ordersByStatus.data} />
            ) : (
              <Skeleton className="h-56" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Precisam de atenção</CardTitle>
            <CardDescription>Os que esperam há mais tempo aparecem primeiro</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <AttentionList
            title="Prontos, aguardando entregador"
            orders={readyOrders.data?.data}
            loading={readyOrders.isLoading}
            emptyMessage="Nenhum pedido pronto esperando."
          />
          <AttentionList
            title="Pendentes, aguardando preparo"
            orders={pendingOrders.data?.data}
            loading={pendingOrders.isLoading}
            emptyMessage="Nenhum pedido pendente."
          />
        </CardContent>
      </Card>
    </div>
  );
}
