import { Label as LabelPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/utils/cn";

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("text-ui leading-none font-medium select-none", className)}
      {...props}
    />
  );
}
