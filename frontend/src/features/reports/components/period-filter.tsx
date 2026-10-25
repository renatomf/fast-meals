import { MAX_REPORT_DAYS } from "@fastmeals/contracts";
import { Input } from "@/design-system/ui/input";
import { Label } from "@/design-system/ui/label";
import { cn } from "@/utils/cn";
import { addDays, lastDays, todayInSaoPaulo, type DateRange } from "@/utils/dates";

type PeriodFilterProps = {
  range: DateRange;
  onChange: (range: DateRange) => void;
};

const presets = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
] as const;

function monthToDate(): DateRange {
  const today = todayInSaoPaulo();
  return { startDate: `${today.slice(0, 8)}01`, endDate: today };
}

// Atalhos para os recortes comuns e datas livres para o resto. A API aceita até 366 dias:
// o campo de data já limita a escolha, em vez de deixar o erro para depois.
export function PeriodFilter({ range, onChange }: PeriodFilterProps) {
  const options = [
    ...presets.map((preset) => ({ label: preset.label, range: lastDays(preset.days).current })),
    { label: "Este mês", range: monthToDate() },
  ];
  const today = todayInSaoPaulo();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div
        role="radiogroup"
        aria-label="Período rápido"
        // Mesma altura dos campos de data (h-8) e alinhado pela base deles no desktop.
        className="flex h-8 w-full rounded-md border bg-background p-0.5 sm:w-auto"
      >
        {options.map((option) => {
          const checked =
            option.range.startDate === range.startDate && option.range.endDate === range.endDate;
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(option.range)}
              className={cn(
                "h-full flex-1 rounded px-2 text-ui font-medium whitespace-nowrap transition-colors duration-150 sm:flex-none sm:px-3",
                checked
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:flex">
        <div className="flex flex-col gap-1">
          <Label htmlFor="report-start" className="text-xs text-muted-foreground">
            De
          </Label>
          <Input
            id="report-start"
            type="date"
            className="h-8 w-full sm:w-40"
            value={range.startDate}
            min={addDays(range.endDate, -(MAX_REPORT_DAYS - 1))}
            max={range.endDate}
            onChange={(event) =>
              event.target.value && onChange({ ...range, startDate: event.target.value })
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="report-end" className="text-xs text-muted-foreground">
            Até
          </Label>
          <Input
            id="report-end"
            type="date"
            className="h-8 w-full sm:w-40"
            value={range.endDate}
            min={range.startDate}
            max={today}
            onChange={(event) =>
              event.target.value && onChange({ ...range, endDate: event.target.value })
            }
          />
        </div>
      </div>
    </div>
  );
}
