import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const APP_NAME = "prosendia";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
