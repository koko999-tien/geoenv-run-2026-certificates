import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeVietnamese(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function formatFileName(name: string, className: string): string {
  const safeName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const safeClass = className.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `Giay-chung-nhan-GEOENV-RUN-2026-${safeName}-${safeClass}.pdf`;
}