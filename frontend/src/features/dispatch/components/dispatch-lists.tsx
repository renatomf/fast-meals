import type { DeliveryPerson, Order } from "@fastmeals/contracts";
import { Bike, Package } from "lucide-react";
import type { ReactNode } from "react";
import { RelativeTime } from "@/design-system/components/relative-time";
import { Badge } from "@/design-system/ui/badge";
import { Skeleton } from "@/design-system/ui/skeleton";
import { cn } from "@/utils/cn";
import { vehicleLabels } from "@/utils/labels";

function ListSection({
  title,
  count,
  icon: Icon,
  children,
}: {
  title: string;
  count: number | undefined;
  icon: typeof Package;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        {title}
        {count !== undefined && <Badge>{count}</Badge>}
      </h2>
      {children}
    </section>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-12" />
      ))}
    </div>
  );
}

type ReadyOrdersListProps = {
  orders: Order[] | undefined;
  loading: boolean;
  activeOrderId?: string;
  onActivate: (orderId: string | undefined) => void;
};

export function ReadyOrdersList({
  orders,
  loading,
  activeOrderId,
  onActivate,
}: ReadyOrdersListProps) {
  return (
    <ListSection title="Pedidos prontos" count={orders?.length} icon={Package}>
      {loading ? (
        <Loading />
      ) : orders?.length === 0 ? (
        <p className="text-ui text-muted-foreground">Nenhum pedido esperando entregador.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {orders?.map((order) => (
            <li
              key={order.id}
              onMouseEnter={() => onActivate(order.id)}
              onMouseLeave={() => onActivate(undefined)}
              className={cn(
                "flex flex-col gap-0.5 px-3 py-2 transition-colors duration-150",
                activeOrderId === order.id && "bg-brand-subtle/50",
              )}
            >
              <span className="flex items-center justify-between gap-2 text-ui font-medium">
                <span className="truncate">{order.customerName}</span>
                {order.deliveryPerson ? (
                  <Badge tone="outline">{order.deliveryPerson.name}</Badge>
                ) : (
                  <span className="shrink-0 text-xs font-normal text-muted-foreground">
                    <RelativeTime iso={order.updatedAt} />
                  </span>
                )}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {order.deliveryAddress}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ListSection>
  );
}

type CouriersListProps = { couriers: DeliveryPerson[] | undefined; loading: boolean };

export function CouriersList({ couriers, loading }: CouriersListProps) {
  return (
    <ListSection title="Entregadores disponíveis" count={couriers?.length} icon={Bike}>
      {loading ? (
        <Loading />
      ) : couriers?.length === 0 ? (
        <p className="text-ui text-muted-foreground">Todos os entregadores ativos estão em rota.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {couriers?.map((courier) => (
            <li key={courier.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-ui font-medium">{courier.name}</span>
                <span className="text-xs text-muted-foreground">
                  {vehicleLabels[courier.vehicleType]}
                </span>
              </span>
              {/* Sem localização o algoritmo não tem como medir a distância. */}
              {courier.currentLatitude === null && <Badge tone="outline">Sem localização</Badge>}
            </li>
          ))}
        </ul>
      )}
    </ListSection>
  );
}
