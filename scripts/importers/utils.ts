export function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function moneyString(value: number): string {
  return roundMoney(value).toFixed(2);
}

export function parsePriceExVat(input: string | number | undefined): number | null {
  if (input === undefined || input === null) {
    return null;
  }

  if (typeof input === "number") {
    return Number.isFinite(input) ? roundMoney(input) : null;
  }

  const raw = input.trim();
  if (!raw) {
    return null;
  }

  const cleaned = raw.replace(/\s+/g, "").replace(/[^\d,.-]/g, "");
  if (!cleaned) {
    return null;
  }

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned.replace(",", ".");
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) {
    return null;
  }
  return roundMoney(value);
}
