import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/utils/cn";

const badgeVariants = cva(
  "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        brand: "bg-brand-subtle text-brand-text",
        outline: "border text-muted-foreground",
        danger: "bg-destructive/10 text-destructive-text",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
