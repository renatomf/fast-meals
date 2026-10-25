import type { ComponentProps } from "react";
import { cn } from "@/utils/cn";

// Símbolo próprio: um "F" com duas linhas de velocidade, sobre o verde da marca. As cores
// vêm dos tokens, então o mesmo SVG serve aos dois temas.
export function LogoMark({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
      {...props}
    >
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <rect x="5" y="12.2" width="5" height="2.4" rx="1.2" className="fill-white" opacity="0.75" />
      <rect
        x="6.5"
        y="17.4"
        width="3.5"
        height="2.4"
        rx="1.2"
        className="fill-white"
        opacity="0.5"
      />
      <path
        d="M13 9.5c0-.83.67-1.5 1.5-1.5H25a1.5 1.5 0 0 1 0 3h-8.4v3.6h6.4a1.5 1.5 0 0 1 0 3h-6.4v5.4a1.8 1.8 0 0 1-3.6 0z"
        className="fill-white"
      />
    </svg>
  );
}

const sizes = {
  sm: { mark: "size-6", text: "text-[15px]" },
  md: { mark: "size-7", text: "text-lg" },
  lg: { mark: "size-11", text: "text-[28px]" },
} as const;

type LogoProps = ComponentProps<"span"> & { size?: keyof typeof sizes };

export function Logo({ size = "md", className, ...props }: LogoProps) {
  return (
    <span data-logo className={cn("inline-flex items-center gap-2", className)} {...props}>
      <LogoMark className={sizes[size].mark} />
      <span className={cn("leading-none font-extrabold tracking-0", sizes[size].text)}>
        Fast<span className="ml-[0.2em] text-brand">Meals</span>
      </span>
    </span>
  );
}
