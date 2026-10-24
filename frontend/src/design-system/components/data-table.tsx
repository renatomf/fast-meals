import type { ReactNode } from "react";
import { Skeleton } from "@/design-system/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system/ui/table";
import { cn } from "@/utils/cn";

export type DataTableColumn<Row> = {
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  align?: "left" | "right";
  className?: string;
};

type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[] | undefined;
  getRowKey: (row: Row) => string;
  loading?: boolean;
  loadingRows?: number;
  // Composição em vez de props booleanas: o estado vazio é da tela.
  emptyState?: ReactNode;
  onRowClick?: (row: Row) => void;
  caption?: string;
};

// Tabela genérica e tipada. Paginação, filtros e ordenação ficam no servidor, então não há
// estado de tabela aqui; por isso não uso uma biblioteca headless (DECISIONS.md).
export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  loading = false,
  loadingRows = 8,
  emptyState,
  onRowClick,
  caption,
}: DataTableProps<Row>) {
  const alignClass = (column: DataTableColumn<Row>) =>
    column.align === "right" ? "text-right" : "";

  return (
    <Table>
      {caption && <caption className="sr-only">{caption}</caption>}
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.id} className={cn(alignClass(column), column.className)}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: loadingRows }, (_, index) => (
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell key={column.id} className={alignClass(column)}>
                    <Skeleton
                      className={cn("h-4", column.align === "right" ? "ml-auto w-16" : "w-24")}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : rows?.map((row) => (
              <TableRow
                key={getRowKey(row)}
                data-clickable={onRowClick ? true : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <TableCell key={column.id} className={cn(alignClass(column), column.className)}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
        {!loading && rows?.length === 0 && (
          <tr>
            <td colSpan={columns.length}>{emptyState}</td>
          </tr>
        )}
      </TableBody>
    </Table>
  );
}
