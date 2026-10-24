import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

// Vazio com motivo e próximo passo, nunca uma área em branco.
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="max-w-sm">
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="mt-1 text-ui text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
