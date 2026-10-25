import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/design-system/ui/button";
import { formatInteger } from "@/utils/format";

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  return (
    <nav
      aria-label="Paginação"
      className="flex items-center justify-between gap-4 px-4 py-3 text-ui"
    >
      <span className="text-muted-foreground tabular-nums">
        {formatInteger(total)} {total === 1 ? "resultado" : "resultados"}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground tabular-nums">
          Página {page} de {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Próxima página"
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
