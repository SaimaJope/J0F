import { getImporterConfig } from "./config";
import { normalizeRawProduct } from "./mapping/normalize";
import { persistNormalizedProducts } from "./persist";
import { fetchAhlsellRawProducts } from "./suppliers/ahlsell";
import { fetchOnninenRawProducts } from "./suppliers/onninen";
import { ImportRunStats, RawSupplierProduct, SupplierKey } from "./types";

interface CliFlags {
  dryRun?: boolean;
  useSampleData?: boolean;
}

export function parseCliFlags(argv: string[]): CliFlags {
  return {
    dryRun: argv.includes("--dry-run") ? true : undefined,
    useSampleData: argv.includes("--sample") ? true : undefined
  };
}

function applyCliOverrides(flags: CliFlags) {
  const config = getImporterConfig();

  return {
    ...config,
    dryRun: flags.dryRun ?? config.dryRun,
    useSampleData: flags.useSampleData ?? config.useSampleData
  };
}

async function fetchBySupplier(
  supplier: SupplierKey,
  config: ReturnType<typeof applyCliOverrides>
): Promise<RawSupplierProduct[]> {
  if (supplier === "ahlsell") {
    return fetchAhlsellRawProducts(config);
  }
  return fetchOnninenRawProducts(config);
}

export async function runSupplierImport(
  supplier: SupplierKey,
  flags: CliFlags
): Promise<ImportRunStats> {
  const config = applyCliOverrides(flags);
  const rawProducts = await fetchBySupplier(supplier, config);

  const normalized = rawProducts
    .map((raw) => normalizeRawProduct(raw, config))
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  const result = await persistNormalizedProducts(normalized, { dryRun: config.dryRun });

  return {
    supplier,
    rawCount: rawProducts.length,
    normalizedCount: normalized.length,
    skippedCount: rawProducts.length - normalized.length,
    persistedCount: result.persistedCount
  };
}

export async function runAllImport(flags: CliFlags): Promise<ImportRunStats> {
  const ahlsell = await runSupplierImport("ahlsell", flags);
  const onninen = await runSupplierImport("onninen", flags);

  return {
    supplier: "all",
    rawCount: ahlsell.rawCount + onninen.rawCount,
    normalizedCount: ahlsell.normalizedCount + onninen.normalizedCount,
    skippedCount: ahlsell.skippedCount + onninen.skippedCount,
    persistedCount: ahlsell.persistedCount + onninen.persistedCount
  };
}

export function printStats(stats: ImportRunStats): void {
  console.log(`Import summary for ${stats.supplier}:`);
  console.log(`- raw: ${stats.rawCount}`);
  console.log(`- normalized: ${stats.normalizedCount}`);
  console.log(`- skipped: ${stats.skippedCount}`);
  console.log(`- persisted: ${stats.persistedCount}`);
}
