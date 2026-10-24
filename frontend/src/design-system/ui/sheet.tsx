import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/utils/cn";
import { DialogOverlay } from "@/design-system/ui/dialog";

// Painel lateral: o mesmo Dialog do Radix, ancorado a um lado. À direita para detalhes e
// formulários (no celular ocupa a largura toda), à esquerda para o menu de navegação.

export const Sheet = DialogPrimitive.Root;
export const SheetClose = DialogPrimitive.Close;

const sides = {
  right: cn(
    "right-0 w-full border-l sm:max-w-lg",
    "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
  ),
  left: cn(
    "left-0 w-72 border-r",
    "data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
  ),
} as const;

type SheetContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  side?: keyof typeof sides;
};

export function SheetContent({ className, children, side = "right", ...props }: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 flex h-full flex-col bg-popover text-popover-foreground shadow-xl",
          "data-[state=open]:animate-in data-[state=open]:duration-200",
          "data-[state=closed]:animate-out data-[state=closed]:duration-150",
          sides[side],
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="size-4" />
          <span className="sr-only">Fechar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-1 border-b px-6 py-5 pr-12", className)} {...props} />
  );
}

export function SheetBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex-1 overflow-y-auto px-6 py-5", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex justify-end gap-2 border-t px-6 py-4", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-base font-semibold", className)} {...props} />;
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-ui text-muted-foreground", className)}
      {...props}
    />
  );
}
