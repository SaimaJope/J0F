import "dotenv/config";
import { ImporterConfig } from "./types";
import { parseBoolean, parseNumber } from "./utils";

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export function getImporterConfig(): ImporterConfig {
  return {
    dryRun: parseBoolean(env("IMPORT_DRY_RUN", "true"), true),
    useSampleData: parseBoolean(env("IMPORT_USE_SAMPLE_DATA", "true"), true),
    markupPercent: parseNumber(env("IMPORT_MARKUP_PERCENT", "25"), 25),
    vatRate: parseNumber(env("IMPORT_DEFAULT_VAT_RATE", "25.5"), 25.5),
    ahlsell: {
      searchUrl: env(
        "AHLSELL_SEARCH_URL",
        "https://www.ahlsell.fi/search?parameters.SearchPhrase=Innova"
      ),
      username: env("AHLSELL_USERNAME"),
      password: env("AHLSELL_PASSWORD")
    },
    onninen: {
      baseUrl: env("ONNINEN_BASE_URL", "https://www.onninen.fi"),
      username: env("ONNINEN_USERNAME"),
      password: env("ONNINEN_PASSWORD")
    }
  };
}
