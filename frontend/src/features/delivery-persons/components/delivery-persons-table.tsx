import type { DeliveryPerson } from "@fastmeals/contracts";
import { Bike, MapPin, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { DataTable, type DataTableColumn } from "@/design-system/components/data-table";
import { EmptyState } from "@/design-system/components/empty-state";
import { Badge } from "@/design-system/ui/badge";
import { Button } from "@/design-system/ui/button";
import { Skeleton } from "@/design-system/ui/skeleton";
import { Tooltip } from "@/design-system/ui/tooltip";
import { READ_ONLY_MESSAGE } from "@/hooks/use-can";
import { vehicleLabels } from "@/utils/labels";

type DeliveryPersonsTableProps = {
  people: DeliveryPerson[] | undefined;
  loading: boolean;
  canWrite: boolean;
  onEdit: (person: DeliveryPerson) => void;
  onDelete: (person: DeliveryPerson) => void;
};

// Situação em uma palavra: inativo, em entrega (tem pedido em andamento) ou livre.
function Situation({ person }: { person: DeliveryPerson }) {
  if (!person.isActive) return <Badge tone="outline">Inativo</Badge>;
  if (person.currentOrderId) {
    return <Badge className="bg-status-delivering-subtle text-status-delivering">Em entrega</Badge>;
  }
  return <Badge tone="brand">Livre</Badge>;
}

function Location({ person }: { person: DeliveryPerson }) {
  if (person.currentLatitude === null || person.currentLongitude === null) {
    return <span className="text-muted-foreground">Sem localização</span>;
  }
  const coordinates = `${person.currentLatitude.toFixed(4)}, ${person.currentLongitude.toFixed(4)}`;
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground tabular-nums">
      <MapPin className="size-3.5" aria-hidden="true" />
      {coordinates}
    </span>
  );
}

function Guarded({ canWrite, children }: { canWrite: boolean; children: ReactNode }) {
  return canWrite ? (
    children
  ) : (
    <Tooltip content={READ_ONLY_MESSAGE}>
      <span tabIndex={0} className="inline-flex rounded-md">
        {children}
      </span>
    </Tooltip>
  );
}

export function DeliveryPersonsTable({
  people,
  loading,
  canWrite,
  onEdit,
  onDelete,
}: DeliveryPersonsTableProps) {
  const actions = (person: DeliveryPerson) => (
    <Guarded canWrite={canWrite}>
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          disabled={!canWrite}
          onClick={() => onEdit(person)}
          aria-label={`Editar ${person.name}`}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!canWrite}
          onClick={() => onDelete(person)}
          aria-label={`Excluir ${person.name}`}
          className="text-destructive-text"
        >
          <Trash2 />
        </Button>
      </div>
    </Guarded>
  );

  const columns: DataTableColumn<DeliveryPerson>[] = [
    {
      id: "name",
      header: "Entregador",
      cell: (person) => (
        <div className="flex flex-col">
          <span className="font-semibold">{person.name}</span>
          <span className="text-xs text-muted-foreground">{person.phone}</span>
        </div>
      ),
    },
    { id: "vehicle", header: "Veículo", cell: (person) => vehicleLabels[person.vehicleType] },
    { id: "situation", header: "Situação", cell: (person) => <Situation person={person} /> },
    { id: "location", header: "Localização", cell: (person) => <Location person={person} /> },
    {
      id: "actions",
      header: <span className="sr-only">Ações</span>,
      align: "right",
      cell: actions,
    },
  ];

  const empty = (
    <EmptyState
      icon={Bike}
      title="Nenhum entregador neste filtro"
      description="Troque o filtro ou cadastre um entregador."
    />
  );

  return (
    <>
      <div className="hidden md:block">
        <DataTable
          caption="Entregadores"
          columns={columns}
          rows={people}
          getRowKey={(person) => person.id}
          loading={loading}
          emptyState={empty}
        />
      </div>
      <ul className="divide-y md:hidden">
        {loading &&
          Array.from({ length: 4 }, (_, index) => (
            <li key={index} className="p-4">
              <Skeleton className="h-12" />
            </li>
          ))}
        {!loading && people?.length === 0 && <li>{empty}</li>}
        {!loading &&
          people?.map((person) => (
            <li key={person.id} className="flex items-center gap-3 p-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-semibold">{person.name}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {vehicleLabels[person.vehicleType]}
                  <Situation person={person} />
                </span>
              </div>
              {actions(person)}
            </li>
          ))}
      </ul>
    </>
  );
}
