import { useNavigate, useSearch } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/design-system/components/empty-state";
import { ErrorState } from "@/design-system/components/error-state";
import { MetricCard } from "@/design-system/components/metric-card";
import { PageHeader } from "@/design-system/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/design-system/ui/card";
import { Skeleton } from "@/design-system/ui/skeleton";
import { lastDays, type DateRange } from "@/utils/dates";
import { formatInteger, formatMinutes, formatMoney, formatShortDate } from "@/utils/format";
import { PeriodFilter } from "../components/period-filter";
import {
  DailyRevenueChart,
  DeliveryTimeByVehicleChart,
  OrdersByStatusChart,
  TopProductsList,
} from "../components/report-charts";
import { TOP_PRODUCTS_LIMIT, useReports } from "../hooks/use-reports";

type QueryState = {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => unknown;
};

// Cada cartão cuida do próprio carregamento e erro: um relatório lento ou com falha não
// derruba os outros três.
function ReportCard({
  title,
  description,
  query,
  empty,
  children,
  className,
}: {
  title: string;
  description?: string;
  query: QueryState;
  empty?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {query.isError ? (
          <ErrorState message={query.error?.message} onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          <Skeleton className="h-56" />
        ) : empty ? (
          <EmptyState icon={BarChart3} title="Sem dados no período" />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function ReportsPage() {
  const search = useSearch({ from: "/app/reports" });
  const navigate = useNavigate({ from: "/reports" });
  const fallback = lastDays(30).current;
  const range: DateRange = {
    startDate: search.startDate ?? fallback.startDate,
    endDate: search.endDate ?? fallback.endDate,
  };
  const { revenue, ordersByStatus, topProducts, deliveryTime } = useReports(range);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Relatórios"
        description={`${formatShortDate(range.startDate)} a ${formatShortDate(range.endDate)}, pela data de criação do pedido`}
      />
      <PeriodFilter
        range={range}
        onChange={(next) =>
          void navigate({ search: { startDate: next.startDate, endDate: next.endDate } })
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Receita"
          loading={revenue.isLoading}
          value={revenue.data && formatMoney(revenue.data.totalRevenue)}
          hint="Pedidos entregues no período"
        />
        <MetricCard
          label="Pedidos entregues"
          loading={revenue.isLoading}
          value={revenue.data && formatInteger(revenue.data.totalOrders)}
          hint={
            ordersByStatus.data && `${formatInteger(ordersByStatus.data.total)} criados no período`
          }
        />
        <MetricCard
          label="Ticket médio"
          loading={revenue.isLoading}
          value={revenue.data && formatMoney(revenue.data.averageOrderValue)}
        />
        <MetricCard
          label="Tempo médio de entrega"
          loading={deliveryTime.isLoading}
          value={
            deliveryTime.data &&
            (deliveryTime.data.totalDelivered > 0
              ? formatMinutes(deliveryTime.data.averageMinutes)
              : "—")
          }
          hint={
            deliveryTime.data && deliveryTime.data.totalDelivered > 0
              ? `De ${formatMinutes(deliveryTime.data.fastestMinutes)} a ${formatMinutes(deliveryTime.data.slowestMinutes)}`
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ReportCard
          title="Receita por dia"
          description="Dias sem venda aparecem como zero"
          query={revenue}
          empty={revenue.data?.totalOrders === 0}
          className="xl:col-span-2"
        >
          {revenue.data && <DailyRevenueChart report={revenue.data} />}
        </ReportCard>
        <ReportCard
          title="Pedidos por status"
          query={ordersByStatus}
          empty={ordersByStatus.data?.total === 0}
        >
          {ordersByStatus.data && <OrdersByStatusChart report={ordersByStatus.data} />}
        </ReportCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ReportCard
          title="Produtos mais vendidos"
          description={`Top ${TOP_PRODUCTS_LIMIT} em unidades`}
          query={topProducts}
          empty={topProducts.data?.data.length === 0}
        >
          {topProducts.data && <TopProductsList report={topProducts.data} />}
        </ReportCard>
        <ReportCard
          title="Tempo de entrega por veículo"
          description="Da criação à entrega"
          query={deliveryTime}
          empty={deliveryTime.data?.totalDelivered === 0}
        >
          {deliveryTime.data && <DeliveryTimeByVehicleChart report={deliveryTime.data} />}
        </ReportCard>
      </div>
    </div>
  );
}
