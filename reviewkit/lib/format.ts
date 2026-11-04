import type { Locale } from "./content/schema";

/** "24 October 2026" for en-GB, "October 24, 2026" for en-US. */
export function formatDate(iso: string, locale: Locale = "en-GB"): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatMoney(amount: number, currency: string, locale: Locale = "en-GB"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Whole days between an ISO date and today, for the price staleness warning. */
export function daysSince(iso: string): number {
  const then = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / 86_400_000);
}

export function priceIsStale(iso: string, maxDays = 30): boolean {
  return daysSince(iso) > maxDays;
}
