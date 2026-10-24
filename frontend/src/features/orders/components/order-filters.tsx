import { orderStatuses, type OrderStatus } from "@fastmeals/contracts";
import { X } from "lucide-react";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";
import { Label } from "@/design-system/ui/label";
import { cn } from "@/utils/cn";
import type { OrdersSearch } from "../search-params";
import { statusMeta } from "./status-badge";

type OrderFiltersProps = {
  search: OrdersSearch;
  onChange: (changes: Partial<OrdersSearch>) => void;
};

const tabs: { value: OrderStatus | undefined; label: string }[] = [
  { value: undefined, label: "Todos" },
  ...orderStatuses.map((status) => ({ value: status, label: statusMeta[status].label })),
];

// Abas de status (padrão Shopify) e período. Toda mudança volta para a página 1.
export function OrderFilters({ search, onChange }: OrderFiltersProps) {
  const hasDates = search.startDate !== undefined || search.endDate !== undefined;

  return (
    <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
      <div
        role="tablist"
        aria-label="Filtrar por status"
        className="-mx-1 flex gap-1 overflow-x-auto px-1"
      >
        {tabs.map((tab) => {
          const selected = search.status === tab.value;
          return (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange({ status: tab.value, page: undefined })}
              className={cn(
                "h-8 shrink-0 rounded-md px-3 text-ui font-medium whitespace-nowrap transition-colors duration-150",
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

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="startDate" className="text-xs text-muted-foreground">
            De
          </Label>
          <Input
            id="startDate"
            type="date"
            className="h-8 w-40"
            value={search.startDate ?? ""}
            max={search.endDate}
            onChange={(event) =>
              onChange({ startDate: event.target.value || undefined, page: undefined })
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="endDate" className="text-xs text-muted-foreground">
            Até
          </Label>
          <Input
            id="endDate"
            type="date"
            className="h-8 w-40"
            value={search.endDate ?? ""}
            min={search.startDate}
            onChange={(event) =>
              onChange({ endDate: event.target.value || undefined, page: undefined })
            }
          />
        </div>
        {hasDates && (
          <Button
            variant="ghost"
            onClick={() => onChange({ startDate: undefined, endDate: undefined, page: undefined })}
          >
            <X /> Limpar datas
          </Button>
        )}
      </div>
    </div>
  );
}
