import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// O tailwind-merge não lê os tokens: sem saber que text-ui é tamanho de fonte, ele o trata
// como cor e descarta a cor do texto da mesma lista (o botão primário perdia o
// text-primary-foreground e ficava com texto claro sobre fundo claro no tema escuro).
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["ui"] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
