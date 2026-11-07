import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Canonical className combiner (clsx + tailwind-merge) used by the design system.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
