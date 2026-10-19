import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Junta classes do Tailwind (mesmo `cn` do portal). */
export function cn(...entradas: ClassValue[]) {
  return twMerge(clsx(entradas));
}
