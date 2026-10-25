import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

type Edges = { start: boolean; end: boolean };

// Faixa que rola na horizontal sem a barra de rolagem: no lugar dela, um esmaecido com seta
// na borda que ainda tem conteúdo. A seta rola a faixa num toque; pelo teclado, o foco em
// cada item já o traz para a vista, então ela fica fora da ordem de tabulação.
export function HorizontalScroller({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<Edges>({ start: false, end: false });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () =>
      setEdges({
        start: element.scrollLeft > 1,
        end: element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
      });
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  function scroll(direction: 1 | -1) {
    const element = ref.current;
    if (!element) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({
      left: direction * element.clientWidth * 0.6,
      behavior: smooth ? "smooth" : "auto",
    });
  }

  const edgeButton = "absolute inset-y-0 flex w-10 items-center text-muted-foreground";

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={ref}
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {edges.start && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => scroll(-1)}
          className={cn(
            edgeButton,
            "left-0 justify-start bg-gradient-to-r from-card via-card/90 to-transparent",
          )}
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      {edges.end && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => scroll(1)}
          className={cn(
            edgeButton,
            "right-0 justify-end bg-gradient-to-l from-card via-card/90 to-transparent",
          )}
        >
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}
