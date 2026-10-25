import { Bike, MapPin, Phone } from "lucide-react";
import { ErrorState } from "@/design-system/components/error-state";
import { Money } from "@/design-system/components/money";
import { RelativeTime } from "@/design-system/components/relative-time";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/design-system/ui/sheet";
import { Skeleton } from "@/design-system/ui/skeleton";
import { vehicleLabels } from "@/utils/labels";
import { useOrder, useOrderHistory } from "../hooks/use-orders";
import { OrderActions } from "./order-actions";
import { OrderTimeline } from "./order-timeline";
import { StatusBadge } from "./status-badge";

type OrderDetailsSheetProps = { orderId: string | undefined; onClose: () => void };

// Detalhe ao lado da lista, sem sair dela (padrão Shopify): o id fica na URL (?order=...).
export function OrderDetailsSheet({ orderId, onClose }: OrderDetailsSheetProps) {
  const order = useOrder(orderId);
  const history = useOrderHistory(orderId);

  return (
    <Sheet open={orderId !== undefined} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {order.isError ? (
          <ErrorState
            title="Pedido não encontrado"
            message="Ele pode ter sido removido ou o link estar incorreto."
          />
        ) : !order.data ? (
          <div className="flex flex-col gap-4 p-6">
            <SheetTitle className="sr-only">Carregando pedido</SheetTitle>
            <SheetDescription className="sr-only">
              Os detalhes do pedido estão carregando.
            </SheetDescription>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <SheetTitle>{order.data.customerName}</SheetTitle>
                <StatusBadge status={order.data.status} />
              </div>
              <SheetDescription>
                Criado <RelativeTime iso={order.data.createdAt} />
              </SheetDescription>
            </SheetHeader>

            <SheetBody className="flex flex-col gap-6">
              <section className="flex flex-col gap-2 text-ui">
                <p className="flex items-start gap-2">
                  <MapPin
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {order.data.deliveryAddress}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {order.data.customerPhone}
                </p>
                <p className="flex items-center gap-2">
                  <Bike className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {order.data.deliveryPerson
                    ? `${order.data.deliveryPerson.name} · ${vehicleLabels[order.data.deliveryPerson.vehicleType]}`
                    : "Sem entregador atribuído"}
                </p>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Itens</h3>
                <ul className="divide-y rounded-lg border">
                  {order.data.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-ui"
                    >
                      <span>
                        <span className="font-semibold tabular-nums">{item.quantity}×</span>{" "}
                        {item.product.name}
                      </span>
                      <Money
                        value={item.unitPrice * item.quantity}
                        className="text-muted-foreground"
                      />
                    </li>
                  ))}
                  <li className="flex items-center justify-between px-3 py-2.5 text-sm font-semibold">
                    Total
                    <Money value={order.data.totalAmount} />
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold text-muted-foreground">Linha do tempo</h3>
                <OrderTimeline history={history.data?.data} loading={history.isLoading} />
              </section>
            </SheetBody>

            <SheetFooter className="justify-start">
              <OrderActions order={order.data} />
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
