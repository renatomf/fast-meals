import type { OptimizeAssignmentResponse } from "@fastmeals/contracts";
import { FlaskConical, Route, Sparkles } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/design-system/components/empty-state";
import { ErrorState } from "@/design-system/components/error-state";
import { PageHeader } from "@/design-system/components/page-header";
import { Button } from "@/design-system/ui/button";
import { Tooltip } from "@/design-system/ui/tooltip";
import { READ_ONLY_MESSAGE, useCan } from "@/hooks/use-can";
import { ApiError } from "@/services/api-client";
import { AssignmentList, type Decision } from "../components/assignment-list";
import { CostMatrixDialog } from "../components/cost-matrix-dialog";
import { CouriersList, ReadyOrdersList } from "../components/dispatch-lists";
import { DispatchMap, type MapPoint, type MapRoute } from "../components/dispatch-map";
import {
  MATRIX_CELL_LIMIT,
  useAcceptAssignment,
  useAvailableCouriers,
  useDemoScenario,
  useOptimizeAssignment,
  useReadyOrders,
} from "../hooks/use-dispatch";
import { SuggestionSummary } from "../components/suggestion-summary";

type Assignment = OptimizeAssignmentResponse["assignments"][number];

const unassignedReasons: Record<string, string> = {
  "No available delivery person": "Sem entregador disponível",
  "Waiting for the next optimization batch": "Aguardando o próximo lote",
};

// Padrão Onfleet: listas e decisões à esquerda, mapa ocupando o resto.
export function DispatchPage() {
  const canWrite = useCan("dispatch:write");
  const readyOrders = useReadyOrders();
  const couriers = useAvailableCouriers();
  const optimize = useOptimizeAssignment();
  const accept = useAcceptAssignment();
  const demo = useDemoScenario();

  const [suggestion, setSuggestion] = useState<OptimizeAssignmentResponse | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [activeOrderId, setActiveOrderId] = useState<string>();
  const [matrixOpen, setMatrixOpen] = useState(false);
  // Nomes guardados no momento da sugestão: um pedido aceito sai da lista de prontos, mas
  // a linha dele continua mostrando de quem era.
  const [suggestedNames, setSuggestedNames] = useState<Map<string, string>>(new Map());

  const orders = readyOrders.data?.data;
  const people = couriers.data?.data;
  // Pedidos já com entregador ficam fora da otimização (a API também os exclui).
  const waitingOrders = orders?.filter((order) => order.deliveryPerson === null);

  const customerNames = useMemo(
    () => new Map(orders?.map((order) => [order.id, order.customerName])),
    [orders],
  );
  const courierNames = useMemo(
    () => new Map(people?.map((person) => [person.id, person.name])),
    [people],
  );

  const openAssignments =
    suggestion?.assignments.filter((item) => decisions[item.orderId] !== "rejected") ?? [];
  const undecided = openAssignments.filter((item) => decisions[item.orderId] === undefined);

  const mapOrders: MapPoint[] = (waitingOrders ?? []).map((order) => ({
    id: order.id,
    position: [order.latitude, order.longitude],
    label: `${order.customerName} · ${order.deliveryAddress}`,
  }));
  const mapCouriers: MapPoint[] = (people ?? []).flatMap((person) =>
    person.currentLatitude === null || person.currentLongitude === null
      ? []
      : [
          {
            id: person.id,
            position: [person.currentLatitude, person.currentLongitude],
            label: person.name,
          },
        ],
  );
  const positions = new Map([...mapOrders, ...mapCouriers].map((point) => [point.id, point]));
  const routes: MapRoute[] = openAssignments.flatMap((item) => {
    const from = positions.get(item.deliveryPersonId);
    const to = positions.get(item.orderId);
    if (!from || !to || decisions[item.orderId] === "accepted") return [];
    return [
      {
        orderId: item.orderId,
        from: from.position,
        to: to.position,
        label: `${item.deliveryPersonName} → ${suggestedNames.get(item.orderId) ?? "pedido"}`,
      },
    ];
  });

  function runOptimization() {
    const cells = (waitingOrders?.length ?? 0) * (people?.length ?? 0);
    optimize.mutate(cells <= MATRIX_CELL_LIMIT, {
      onSuccess: (result) => {
        setSuggestion(result);
        setDecisions({});
        setSuggestedNames(new Map(customerNames));
        if (result.assignments.length === 0) toast.info("Nenhuma atribuição possível agora.");
      },
      onError: (error) => toast.error(error.message),
    });
  }

  // Otimista: a sugestão aparece aceita na hora. Se a API recusar (outro operador atribuiu
  // o entregador antes, por exemplo), volta para a lista com o motivo. mutateAsync, e não
  // mutate com callbacks: no "Aceitar todas", os callbacks de mutate só disparariam para a
  // última chamada.
  async function acceptOne(assignment: Assignment) {
    setDecisions((current) => ({ ...current, [assignment.orderId]: "accepted" }));
    try {
      await accept.mutateAsync({
        orderId: assignment.orderId,
        deliveryPersonId: assignment.deliveryPersonId,
      });
    } catch (error) {
      setDecisions((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([orderId]) => orderId !== assignment.orderId),
        ),
      );
      toast.error(
        `${assignment.deliveryPersonName}: ${error instanceof Error ? error.message : "falha ao aceitar"}`,
      );
    }
  }

  function rejectOne(assignment: Assignment) {
    setDecisions((current) => ({ ...current, [assignment.orderId]: "rejected" }));
  }

  function createScenario() {
    demo.mutate(undefined, {
      onSuccess: ({ orders: created, deliveryPersons }) => {
        setSuggestion(null);
        setDecisions({});
        toast.success(
          `Cenário criado: ${created} pedidos e ${deliveryPersons} entregadores. Agora peça a sugestão.`,
        );
      },
      onError: (error) =>
        toast.error(
          error instanceof ApiError && error.status === 404
            ? "O cenário de demonstração está desligado neste ambiente (DEMO_MODE)."
            : error.message,
        ),
    });
  }

  const loading = readyOrders.isLoading || couriers.isLoading;
  const nothingToDo = !loading && (waitingOrders?.length ?? 0) === 0;

  const optimizeButton = (
    <Button
      variant="brand"
      onClick={runOptimization}
      disabled={!canWrite || optimize.isPending || nothingToDo || (people?.length ?? 0) === 0}
    >
      <Sparkles /> {optimize.isPending ? "Calculando…" : "Sugerir Atribuição Otimizada"}
    </Button>
  );
  const demoButton = (
    <Button variant="secondary" onClick={createScenario} disabled={!canWrite || demo.isPending}>
      <FlaskConical /> Cenário de demonstração
    </Button>
  );
  const guarded = (button: ReactNode) =>
    canWrite ? (
      button
    ) : (
      <Tooltip content={READ_ONLY_MESSAGE}>
        <span tabIndex={0} className="rounded-md">
          {button}
        </span>
      </Tooltip>
    );

  if (readyOrders.isError || couriers.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Despacho" />
        <ErrorState
          message={(readyOrders.error ?? couriers.error)?.message}
          onRetry={() => void Promise.all([readyOrders.refetch(), couriers.refetch()])}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Despacho"
        description="Pedidos prontos e entregadores livres. A sugestão minimiza a distância total."
        actions={
          <div className="flex flex-wrap gap-2">
            {guarded(demoButton)}
            {guarded(optimizeButton)}
          </div>
        }
      />

      <div className="grid gap-4 lg:h-[calc(100svh-12rem)] lg:min-h-140 lg:grid-cols-[380px_1fr]">
        <aside
          aria-label="Pedidos, entregadores e sugestões"
          className="flex min-h-0 flex-col gap-5 lg:overflow-y-auto lg:pr-1"
        >
          {suggestion ? (
            <>
              <SuggestionSummary
                suggestion={suggestion}
                onOpenMatrix={suggestion.costMatrix ? () => setMatrixOpen(true) : undefined}
              />
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Sugestões ({openAssignments.length})</h2>
                  <div className="flex gap-1">
                    {canWrite && undecided.length > 1 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => undecided.forEach((item) => void acceptOne(item))}
                      >
                        Aceitar todas
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSuggestion(null);
                        setDecisions({});
                      }}
                    >
                      Descartar
                    </Button>
                  </div>
                </div>
                {openAssignments.length === 0 ? (
                  <p className="text-ui text-muted-foreground">
                    Todas as sugestões foram rejeitadas. Peça uma nova sugestão.
                  </p>
                ) : (
                  <AssignmentList
                    assignments={openAssignments}
                    decisions={decisions}
                    customerNames={suggestedNames}
                    canWrite={canWrite}
                    activeOrderId={activeOrderId}
                    onActivate={setActiveOrderId}
                    onAccept={(item) => void acceptOne(item)}
                    onReject={rejectOne}
                  />
                )}
              </section>
              {suggestion.unassigned.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h2 className="text-sm font-semibold">
                    Sem atribuição ({suggestion.unassigned.length})
                  </h2>
                  <ul className="flex flex-col divide-y rounded-lg border">
                    {suggestion.unassigned.map((item) => (
                      <li key={item.orderId} className="flex flex-col px-3 py-2">
                        <span className="text-ui font-medium">
                          {suggestedNames.get(item.orderId) ?? item.orderAddress}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {unassignedReasons[item.reason] ?? item.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : nothingToDo ? (
            <div className="rounded-lg border">
              <EmptyState
                icon={Route}
                title="Nenhum pedido esperando entregador"
                description={
                  canWrite
                    ? "Crie o cenário de demonstração para ver o algoritmo escolher entregadores."
                    : "Quando um pedido ficar pronto, ele aparece aqui."
                }
              />
            </div>
          ) : null}

          <ReadyOrdersList
            orders={orders}
            loading={readyOrders.isLoading}
            activeOrderId={activeOrderId}
            onActivate={setActiveOrderId}
          />
          <CouriersList couriers={people} loading={couriers.isLoading} />
        </aside>

        <div
          // No celular o mapa vem antes das listas; no desktop fica à direita.
          className="relative order-first h-[45svh] min-h-72 lg:order-none lg:h-full"
          aria-label="Mapa de despacho"
          role="region"
        >
          <DispatchMap
            orders={mapOrders}
            couriers={mapCouriers}
            routes={routes}
            activeOrderId={activeOrderId}
            onActivateOrder={setActiveOrderId}
          />
          <ul
            aria-label="Legenda do mapa"
            className="absolute top-3 right-3 z-10 flex flex-col gap-1 rounded-md border bg-background/90 px-3 py-2 text-xs shadow-sm"
          >
            <li className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-status-ready" aria-hidden="true" />
              Pedido pronto
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-info" aria-hidden="true" />
              Entregador livre
            </li>
            <li className="flex items-center gap-2">
              <span className="h-0.5 w-3 rounded-full bg-brand" aria-hidden="true" />
              Sugestão
            </li>
          </ul>
        </div>
      </div>

      {suggestion?.costMatrix && (
        <CostMatrixDialog
          open={matrixOpen}
          onOpenChange={setMatrixOpen}
          matrix={suggestion.costMatrix}
          assignments={suggestion.assignments}
          customerNames={suggestedNames}
          courierNames={courierNames}
        />
      )}
    </div>
  );
}
