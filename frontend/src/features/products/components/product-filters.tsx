import { productCategories } from "@fastmeals/contracts";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/design-system/ui/button";
import { Input, NativeSelect } from "@/design-system/ui/input";
import { Label } from "@/design-system/ui/label";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { categoryLabels } from "@/utils/labels";
import type { ProductsSearch } from "../search-params";

type ProductFiltersProps = {
  search: ProductsSearch;
  onChange: (changes: Partial<ProductsSearch>) => void;
};

const sortOptions = [
  { value: "createdAt:desc", label: "Mais recentes" },
  { value: "name:asc", label: "Nome (A–Z)" },
  { value: "price:asc", label: "Menor preço" },
  { value: "price:desc", label: "Maior preço" },
] as const;

// Toda mudança de filtro volta para a página 1.
export function ProductFilters({ search, onChange }: ProductFiltersProps) {
  const [text, setText] = useState(search.search ?? "");
  const debounced = useDebouncedValue(text.trim());

  useEffect(() => {
    if (debounced !== (search.search ?? "")) {
      onChange({ search: debounced || undefined, page: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage ao texto digitado
  }, [debounced]);

  const sort = `${search.sortBy ?? "createdAt"}:${search.sortOrder ?? "desc"}`;
  const filtered =
    text !== "" || search.category !== undefined || search.availability !== undefined;

  return (
    <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-end">
      <div className="flex flex-1 flex-col gap-1">
        <Label htmlFor="product-search" className="text-xs text-muted-foreground">
          Buscar
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="product-search"
            type="search"
            placeholder="Nome ou descrição"
            className="h-8 pl-8"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex">
        <div className="flex flex-col gap-1">
          <Label htmlFor="product-category" className="text-xs text-muted-foreground">
            Categoria
          </Label>
          <NativeSelect
            id="product-category"
            className="h-8 lg:w-44"
            value={search.category ?? ""}
            onChange={(event) =>
              onChange({
                category: (event.target.value || undefined) as ProductsSearch["category"],
                page: undefined,
              })
            }
          >
            <option value="">Todas</option>
            {productCategories.map((category) => (
              <option key={category} value={category}>
                {categoryLabels[category]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="product-availability" className="text-xs text-muted-foreground">
            Disponibilidade
          </Label>
          <NativeSelect
            id="product-availability"
            className="h-8 lg:w-40"
            value={search.availability ?? ""}
            onChange={(event) =>
              onChange({
                availability: (event.target.value || undefined) as ProductsSearch["availability"],
                page: undefined,
              })
            }
          >
            <option value="">Todos</option>
            <option value="available">Disponíveis</option>
            <option value="unavailable">Indisponíveis</option>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="product-sort" className="text-xs text-muted-foreground">
            Ordenar por
          </Label>
          <NativeSelect
            id="product-sort"
            className="h-8 lg:w-40"
            value={sort}
            onChange={(event) => {
              const [sortBy, sortOrder] = event.target.value.split(":") as [
                NonNullable<ProductsSearch["sortBy"]>,
                NonNullable<ProductsSearch["sortOrder"]>,
              ];
              const isDefault = sortBy === "createdAt" && sortOrder === "desc";
              onChange({
                sortBy: isDefault ? undefined : sortBy,
                sortOrder: isDefault ? undefined : sortOrder,
                page: undefined,
              });
            }}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {filtered && (
        <Button
          variant="ghost"
          onClick={() => {
            setText("");
            onChange({
              search: undefined,
              category: undefined,
              availability: undefined,
              page: undefined,
            });
          }}
        >
          <X /> Limpar filtros
        </Button>
      )}
    </div>
  );
}
