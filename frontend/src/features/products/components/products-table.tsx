import type { Product } from "@fastmeals/contracts";
import { ImageOff, Pencil, Trash2, UtensilsCrossed } from "lucide-react";
import type { ReactNode } from "react";
import { DataTable, type DataTableColumn } from "@/design-system/components/data-table";
import { EmptyState } from "@/design-system/components/empty-state";
import { Money } from "@/design-system/components/money";
import { Badge } from "@/design-system/ui/badge";
import { Button } from "@/design-system/ui/button";
import { Skeleton } from "@/design-system/ui/skeleton";
import { Switch } from "@/design-system/ui/switch";
import { Tooltip } from "@/design-system/ui/tooltip";
import { READ_ONLY_MESSAGE } from "@/hooks/use-can";
import { formatMinutes } from "@/utils/format";
import { categoryLabels } from "@/utils/labels";

type ProductsTableProps = {
  products: Product[] | undefined;
  loading: boolean;
  canWrite: boolean;
  onToggle: (product: Product, isAvailable: boolean) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  emptyAction?: ReactNode;
};

function Thumbnail({ product }: { product: Product }) {
  return product.imageUrl ? (
    <img
      src={product.imageUrl}
      alt=""
      loading="lazy"
      className="size-10 shrink-0 rounded-md border bg-muted object-cover"
    />
  ) : (
    <span className="grid size-10 shrink-0 place-items-center rounded-md border bg-muted text-muted-foreground">
      <ImageOff className="size-4" aria-hidden="true" />
    </span>
  );
}

// Ações do viewer aparecem desabilitadas, com o motivo no tooltip.
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

export function ProductsTable({
  products,
  loading,
  canWrite,
  onToggle,
  onEdit,
  onDelete,
  emptyAction,
}: ProductsTableProps) {
  const availability = (product: Product) => (
    <Guarded canWrite={canWrite}>
      <Switch
        checked={product.isAvailable}
        disabled={!canWrite}
        onCheckedChange={(checked) => onToggle(product, checked)}
        aria-label={`${product.name} disponível`}
      />
    </Guarded>
  );
  const actions = (product: Product) => (
    <Guarded canWrite={canWrite}>
      <div className="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          disabled={!canWrite}
          onClick={() => onEdit(product)}
          aria-label={`Editar ${product.name}`}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!canWrite}
          onClick={() => onDelete(product)}
          aria-label={`Excluir ${product.name}`}
          className="text-destructive-text"
        >
          <Trash2 />
        </Button>
      </div>
    </Guarded>
  );

  const columns: DataTableColumn<Product>[] = [
    {
      id: "product",
      header: "Produto",
      cell: (product) => (
        <div className="flex items-center gap-3">
          <Thumbnail product={product} />
          <div className="flex min-w-0 flex-col">
            <span className="font-semibold">{product.name}</span>
            <span
              title={product.description}
              className="block max-w-96 truncate text-xs text-muted-foreground"
            >
              {product.description}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "category",
      header: "Categoria",
      cell: (product) => <Badge>{categoryLabels[product.category]}</Badge>,
    },
    {
      id: "preparation",
      header: "Preparo",
      align: "right",
      cell: (product) => (
        <span className="text-muted-foreground">{formatMinutes(product.preparationTime)}</span>
      ),
    },
    {
      id: "price",
      header: "Preço",
      align: "right",
      cell: (product) => <Money value={product.price} className="font-semibold" />,
    },
    { id: "available", header: "Disponível", cell: availability },
    {
      id: "actions",
      header: <span className="sr-only">Ações</span>,
      align: "right",
      cell: actions,
    },
  ];

  const empty = (
    <EmptyState
      icon={UtensilsCrossed}
      title="Nenhum produto encontrado"
      description="Ajuste a busca ou os filtros, ou cadastre um produto novo."
      action={emptyAction}
    />
  );

  return (
    <>
      <div className="hidden md:block">
        <DataTable
          caption="Produtos do cardápio"
          columns={columns}
          rows={products}
          getRowKey={(product) => product.id}
          loading={loading}
          emptyState={empty}
        />
      </div>

      <ul className="divide-y md:hidden">
        {loading &&
          Array.from({ length: 5 }, (_, index) => (
            <li key={index} className="p-4">
              <Skeleton className="h-14" />
            </li>
          ))}
        {!loading && products?.length === 0 && <li>{empty}</li>}
        {!loading &&
          products?.map((product) => (
            <li key={product.id} className="flex items-center gap-3 p-4">
              <Thumbnail product={product} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold">{product.name}</span>
                <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <Money value={product.price} className="font-semibold text-foreground" />
                  <span className="truncate">{categoryLabels[product.category]}</span>
                </span>
              </div>
              {availability(product)}
              {actions(product)}
            </li>
          ))}
      </ul>
    </>
  );
}
