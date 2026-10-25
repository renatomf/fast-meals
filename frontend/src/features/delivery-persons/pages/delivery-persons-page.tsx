import type { DeliveryPerson } from "@fastmeals/contracts";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/design-system/components/confirm-dialog";
import { ErrorState } from "@/design-system/components/error-state";
import { PageHeader } from "@/design-system/components/page-header";
import { Button } from "@/design-system/ui/button";
import { Card } from "@/design-system/ui/card";
import { Tooltip } from "@/design-system/ui/tooltip";
import { READ_ONLY_MESSAGE, useCan } from "@/hooks/use-can";
import { ApiError } from "@/services/api-client";
import { HorizontalScroller } from "@/design-system/components/horizontal-scroller";
import { cn } from "@/utils/cn";
import { DeliveryPersonFormSheet } from "../components/delivery-person-form-sheet";
import { DeliveryPersonsTable } from "../components/delivery-persons-table";
import { useDeleteDeliveryPerson, useDeliveryPersons } from "../hooks/use-delivery-persons";
import type { DeliveryPersonsSearch } from "../search-params";
import type { DeliveryPersonFilters } from "../services/delivery-persons-api";

const tabs: { value: DeliveryPersonsSearch["filter"]; label: string }[] = [
  { value: undefined, label: "Todos" },
  { value: "available", label: "Livres" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
];

const filtersFor: Record<NonNullable<DeliveryPersonsSearch["filter"]>, DeliveryPersonFilters> = {
  active: { isActive: true },
  inactive: { isActive: false },
  // Mesmos filtros do despacho: o cache é compartilhado entre as duas telas.
  available: { isActive: true, available: true },
};

export function DeliveryPersonsPage() {
  const search = useSearch({ from: "/app/delivery-persons" });
  const navigate = useNavigate({ from: "/delivery-persons" });
  const canWrite = useCan("delivery-persons:write");
  const [editing, setEditing] = useState<DeliveryPerson | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<DeliveryPerson | null>(null);

  const people = useDeliveryPersons(search.filter ? filtersFor[search.filter] : {});
  const remove = useDeleteDeliveryPerson();

  function confirmDelete() {
    if (!deleting) return;
    const person = deleting;
    remove.mutate(person.id, {
      onSuccess: () => {
        setDeleting(null);
        toast.success(`${person.name} removido`);
      },
      onError: (error) => {
        setDeleting(null);
        toast.error(
          error instanceof ApiError && error.code === "DELIVERY_PERSON_IN_USE"
            ? `${person.name} está com um pedido em entrega. Espere a entrega terminar ou desative o cadastro.`
            : error.message,
        );
      },
    });
  }

  const newButton = (
    <Button onClick={() => setEditing(null)} disabled={!canWrite}>
      <Plus /> Novo entregador
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Entregadores"
        description="Cadastro, veículo, situação e localização."
        actions={
          canWrite ? (
            newButton
          ) : (
            <Tooltip content={READ_ONLY_MESSAGE}>
              <span tabIndex={0} className="rounded-md">
                {newButton}
              </span>
            </Tooltip>
          )
        }
      />

      <Card className="overflow-hidden">
        <HorizontalScroller className="border-b px-4 py-3">
          <div role="tablist" aria-label="Filtrar entregadores" className="flex w-max gap-1">
            {tabs.map((tab) => {
              const selected = search.filter === tab.value;
              return (
                <button
                  key={tab.label}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => void navigate({ search: { filter: tab.value } })}
                  className={cn(
                    "h-8 shrink-0 rounded-md px-3 text-ui font-medium transition-colors duration-150",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </HorizontalScroller>
        {people.isError ? (
          <ErrorState message={people.error.message} onRetry={() => void people.refetch()} />
        ) : (
          <DeliveryPersonsTable
            people={people.data?.data}
            loading={people.isLoading}
            canWrite={canWrite}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
        )}
      </Card>

      <DeliveryPersonFormSheet person={editing} onClose={() => setEditing(undefined)} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Remover este entregador?"
        description={`${deleting?.name ?? "O entregador"} sai do cadastro. As entregas já feitas continuam no histórico.`}
        confirmLabel="Remover entregador"
        tone="danger"
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
