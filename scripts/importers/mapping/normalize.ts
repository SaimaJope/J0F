import { ImporterConfig, NormalizedProduct, RawSupplierProduct } from "../types";
import { parsePriceExVat, roundMoney } from "../utils";

function sourceForSupplier(supplier: RawSupplierProduct["supplier"]): NormalizedProduct["source"] {
  return supplier === "ahlsell" ? "AHLSELL" : "ONNINEN";
}

function sanitizeSku(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function sanitizeName(value: string | undefined): string {
  return (value ?? "").trim();
}

function sanitizeText(value: string | undefined): string | null {
  const cleaned = (value ?? "").trim();
  return cleaned || null;
}

function sanitizePath(path: string[] | undefined): string[] {
  if (!path || path.length === 0) {
    return ["Uncategorized"];
  }

  return path.map((segment) => segment.trim()).filter(Boolean);
}

function getSourcePriceExVat(raw: RawSupplierProduct): number | null {
  const fromNumber = parsePriceExVat(raw.priceExVat);
  if (fromNumber !== null) {
    return fromNumber;
  }
  return parsePriceExVat(raw.priceText);
}

function calculateSellPriceExVat(sourcePriceExVat: number, markupPercent: number): number {
  return roundMoney(sourcePriceExVat * (1 + markupPercent / 100));
}

export function normalizeRawProduct(
  raw: RawSupplierProduct,
  config: ImporterConfig
): NormalizedProduct | null {
  const sku = sanitizeSku(raw.sku);
  const name = sanitizeName(raw.name);
  const sourcePriceExVat = getSourcePriceExVat(raw);

  if (!sku || !name || sourcePriceExVat === null || sourcePriceExVat <= 0) {
    return null;
  }

  const markupPercent = config.markupPercent;
  const sellPriceExVat = calculateSellPriceExVat(sourcePriceExVat, markupPercent);

  return {
    source: sourceForSupplier(raw.supplier),
    name,
    sku,
    description: sanitizeText(raw.description),
    manufacturer: sanitizeText(raw.manufacturer),
    categoryPath: sanitizePath(raw.categoryPath),
    sourceUrl: (raw.sourceUrl ?? "").trim(),
    imageUrls: raw.imageUrls?.filter(Boolean) ?? [],
    sourcePriceExVat,
    markupPercent,
    priceExVat: sellPriceExVat,
    vatRate: config.vatRate,
    specifications: {
      ...(raw.specs ?? {}),
      importPricing: {
        sourcePriceIsExVat: true,
        sourceVatRate: 0,
        markupPercent,
        computedPriceExVat: sellPriceExVat
      }
    },
    lastScrapedAt: new Date()
  };
}
