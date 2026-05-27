export type SupplierKey = "ahlsell" | "onninen";

export type NormalizedSource = "AHLSELL" | "ONNINEN";

export interface RawSupplierProduct {
  supplier: SupplierKey;
  name?: string;
  sku?: string;
  description?: string;
  manufacturer?: string;
  categoryPath?: string[];
  sourceUrl?: string;
  imageUrls?: string[];
  priceText?: string;
  priceExVat?: number;
  specs?: Record<string, string | number | boolean | null>;
}

export interface NormalizedProduct {
  source: NormalizedSource;
  name: string;
  sku: string;
  description: string | null;
  manufacturer: string | null;
  categoryPath: string[];
  sourceUrl: string;
  imageUrls: string[];
  sourcePriceExVat: number;
  markupPercent: number;
  priceExVat: number;
  vatRate: number;
  specifications: Record<string, unknown>;
  lastScrapedAt: Date;
}

export interface ImporterConfig {
  dryRun: boolean;
  useSampleData: boolean;
  markupPercent: number;
  vatRate: number;
  ahlsell: {
    searchUrl: string;
    username: string;
    password: string;
  };
  onninen: {
    baseUrl: string;
    username: string;
    password: string;
  };
}

export interface ImportRunStats {
  supplier: SupplierKey | "all";
  rawCount: number;
  normalizedCount: number;
  skippedCount: number;
  persistedCount: number;
}
