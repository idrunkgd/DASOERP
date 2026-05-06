import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string | null | undefined, currency = "EUR") {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export function formatNumber(value: number | string | null | undefined, digits = 2) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("fr-BE", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}

export function formatPercent(value: number | string | null | undefined, digits = 1) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("fr-BE", { style: "percent", maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n / 100);
}

export function formatDate(value: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fr-BE", opts ?? { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
