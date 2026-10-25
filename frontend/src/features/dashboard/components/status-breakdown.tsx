import type { OrdersByStatusReport } from "@fastmeals/contracts";
import { statusMeta } from "@/features/orders";
import { formatInteger } from "@/utils/format";

// Barras horizontais em HTML: rótulo, número e proporção legíveis por leitor de tela, com a
// mesma cor de status dos badges.
export function StatusBreakdown({ report }: { report: OrdersByStatusReport }) {
  const largest = Math.max(...report.data.map((row) => row.count), 1);

  return (
    <ul className="flex flex-col gap-3">
      {report.data.map((row) => (
        <li key={row.status} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-ui">
            <span className="font-medium">{statusMeta[row.status].label}</span>
            <span className="text-muted-foreground tabular-nums">{formatInteger(row.count)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${statusMeta[row.status].dot}`}
              style={{ width: `${(row.count / largest) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
