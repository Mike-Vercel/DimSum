import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["micro", "caption", "body-sm", "body", "title-sm", "title", "headline", "display", "hero"],
      radius: ["xs", "sm", "md", "lg", "xl", "2xl", "3xl"],
      shadow: ["xs", "sm", "md", "lg", "sheet", "cta", "ring"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
