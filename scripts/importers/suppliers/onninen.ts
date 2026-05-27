import { chromium, Browser, Page } from "playwright";
import { ImporterConfig, RawSupplierProduct } from "../types";

// ─── Sample data (unchanged) ────────────────────────────────────────────────

const ONNINEN_SAMPLE_PRODUCTS: RawSupplierProduct[] = [
  {
    supplier: "onninen",
    sku: "ONN-777-1001",
    name: "Palloventtiili kulmaliitos 15 mm",
    description: "Onninen venttiilikategorian esimerkkituote.",
    manufacturer: "Onnline",
    categoryPath: ["Venttiilit"],
    sourceUrl: "https://www.onninen.fi/kylma/venttiilit/c/777/example-1",
    imageUrls: ["https://www.onninen.fi/images/onn-777-1001.jpg"],
    priceText: "36,40 €",
    specs: { categoryCode: "777", material: "Messinki" }
  },
  {
    supplier: "onninen",
    sku: "ONN-797-2201",
    name: "Kylmaaine R32 9kg",
    description: "Onninen kylmaainekategorian esimerkkituote.",
    manufacturer: "RefTech",
    categoryPath: ["Kylmaaineet"],
    sourceUrl:
      "https://www.onninen.fi/kylma/kylmaaineet-ja-lammonsiirtonesteet/c/797/example-2",
    imageUrls: ["https://www.onninen.fi/images/onn-797-2201.jpg"],
    priceExVat: 215.0,
    specs: { categoryCode: "797", packageSize: "9kg" }
  }
];

// ─── Runtime knobs ──────────────────────────────────────────────────────────

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key]?.trim().toLowerCase();
  if (!v) return fallback;
  return v === "true" || v === "1" || v === "yes";
}

function envInt(key: string, fallback: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : fallback;
}

const HEADLESS = envBool("ONNINEN_HEADLESS", true);
const MAX_PAGES = envInt("ONNINEN_MAX_PAGES", 20);
const PAGE_DELAY_MS = envInt("ONNINEN_PAGE_DELAY_MS", 1500);
const FETCH_DETAILS = envBool("ONNINEN_FETCH_DETAILS", true);
const DETAIL_DELAY_MS = envInt("ONNINEN_DETAIL_DELAY_MS", 800);
const RENDER_WAIT_MS = envInt("ONNINEN_RENDER_WAIT_MS", 3000);

// ─── Source paths to crawl ──────────────────────────────────────────────────

interface CrawlSource {
  path: string;
  categoryHint: string[];
}

const CRAWL_SOURCES: CrawlSource[] = [
  {
    path: "/kylma/venttiilit/c/777",
    categoryHint: ["Kylmä", "Venttiilit"]
  },
  {
    path: "/kylma/kylman-asennustarvikkeet/c/787",
    categoryHint: ["Kylmä", "Asennustarvikkeet"]
  },
  {
    path: "/kylma/kylmaaineet-ja-lammonsiirtonesteet/c/797",
    categoryHint: ["Kylmä", "Kylmäaineet"]
  },
  {
    path: "/kylma/ohjaus-ja-valvonta/c/803",
    categoryHint: ["Kylmä", "Ohjaus ja Valvonta"]
  },
  {
    path: "/search?term=asennuskanava",
    categoryHint: ["Asennuskanava"]
  },
  {
    path: "/search?term=suojakouru",
    categoryHint: ["Suojakouru"]
  }
];

// ─── Selectors (tuned against live onninen.fi, Feb 2026) ────────────────────

const SEL = {
  // Cookie consent
  cookieAccept: "#kconsent-accept-all",

  // Login page (/login)
  loginUsername: "#accountId",
  loginPassword: "#password",
  loginSubmit: "button.test-login__submit",

  // Product listing
  productCard: "div.product-card",
  cardTitleLink: "a.product-card-grid__product-title",
  cardImageLink: "a.product-card-grid__image",
  cardSkuDiv: "div.short-product-codes",
  cardBrandDiv: "div.product-card-grid__brand-header",

  // Pagination
  nextPageBtn: "a.test-next-page-button",
  pageLink: "a.pagination__page",

  // Product detail page
  detailH1: "h1",
  detailShortDesc: "div.test-product__short-description",
  detailLongDesc: "div.long-description",
  detailBreadcrumb: "a.breadcrumb__link",
  detailSpecRow: "div.specification-row",
  detailSpecLabel: "span.specification-row__label",
  detailSpecValue: "span.specification-row__value",
  detailProductImage: "img.imgix-image",
  detailProductCodes: "div.product-codes",
  detailPrice: '[class*="price"]'
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[onninen] ${msg}`);
}
function warn(msg: string) {
  console.warn(`[onninen] WARN: ${msg}`);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function resolveUrl(
  href: string | null | undefined,
  base: string
): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

/** Extract SKU from product URL like /brand-name/p/AAJ065 */
function skuFromUrl(href: string): string | undefined {
  const m = href.match(/\/p\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : undefined;
}

/** Parse "Tuotekoodi4125110" → "4125110" */
function parseSkuText(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(/Tuotekoodi\s*(\S+)/i);
  return m ? m[1] : undefined;
}

// ─── Cookie consent ─────────────────────────────────────────────────────────

async function dismissCookies(page: Page): Promise<void> {
  // Try Onninen's own cookie banner first
  const ownBtn = await page.$(SEL.cookieAccept).catch(() => null);
  if (ownBtn) {
    log("Dismissing Onninen cookie consent...");
    await ownBtn.click().catch(() => {});
    await sleep(1000);
  }
  // Also handle OneTrust banner (sometimes present)
  const otBtn = await page.$("#onetrust-accept-btn-handler").catch(() => null);
  if (otBtn) {
    log("Dismissing OneTrust cookie consent...");
    await otBtn.click().catch(() => {});
    await sleep(1000);
  }
}

// ─── Login (optional) ───────────────────────────────────────────────────────

async function login(
  page: Page,
  baseUrl: string,
  username: string,
  password: string
): Promise<void> {
  log("Logging in...");
  await page.goto(`${baseUrl}/login`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await sleep(RENDER_WAIT_MS);
  await dismissCookies(page);

  await page.fill(SEL.loginUsername, username);
  await page.fill(SEL.loginPassword, password);
  await page.click(SEL.loginSubmit);

  await page
    .waitForLoadState("domcontentloaded", { timeout: 15_000 })
    .catch(() => {});
  await sleep(3000);

  // Verify login by checking if login button is gone
  const stillLogin = await page
    .locator(SEL.loginSubmit)
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  if (stillLogin) {
    throw new Error(
      "Onninen login failed – login form still visible. Check credentials."
    );
  }

  log("Login OK.");
}

// ─── Card extraction from listing page ──────────────────────────────────────

interface RawCardData {
  href: string | null;
  name: string | null;
  skuText: string | null;
  brandAlt: string | null;
  imgSrc: string | null;
}

async function extractCardsFromPage(
  page: Page
): Promise<RawCardData[]> {
  const count = await page.locator(SEL.productCard).count().catch(() => 0);
  if (count === 0) return [];

  log(`${count} product cards found.`);

  // Run extraction inside browser context.
  // Avoid const arrow fn assignments (tsx __name bug).
  const raw: RawCardData[] = await page.$$eval(
    SEL.productCard,
    (cards, sel) => {
      return cards.map((card) => {
        // Title link
        const titleLink = card.querySelector(sel.titleLink);
        const href = titleLink?.getAttribute("href") ?? null;
        const name = titleLink?.textContent?.trim() ?? null;

        // SKU text
        const skuDiv = card.querySelector(sel.skuDiv);
        const skuText = skuDiv?.textContent?.trim() ?? null;

        // Brand (logo img alt)
        const brandDiv = card.querySelector(sel.brandDiv);
        const brandImg = brandDiv?.querySelector("img");
        const brandAlt = brandImg?.getAttribute("alt")?.trim() ?? null;

        // Product image
        const imgLink = card.querySelector(sel.imgLink);
        const img = imgLink?.querySelector("img");
        const imgSrc = img?.getAttribute("src") ?? null;

        return { href, name, skuText, brandAlt, imgSrc };
      });
    },
    {
      titleLink: SEL.cardTitleLink,
      skuDiv: SEL.cardSkuDiv,
      brandDiv: SEL.cardBrandDiv,
      imgLink: SEL.cardImageLink
    }
  );

  return raw;
}

// ─── Pagination ─────────────────────────────────────────────────────────────

async function clickNextPage(page: Page): Promise<boolean> {
  const next = await page.$(SEL.nextPageBtn).catch(() => null);
  if (!next) return false;

  const href = await next.getAttribute("href").catch(() => null);
  if (!href) return false;

  try {
    await next.click();
    await page
      .waitForLoadState("domcontentloaded", { timeout: 15_000 })
      .catch(() => {});
    await sleep(RENDER_WAIT_MS);
    return true;
  } catch {
    return false;
  }
}

// ─── Subcategory detection ──────────────────────────────────────────────────

async function detectSubcategoryLinks(page: Page): Promise<CrawlSource[]> {
  // Subcategory tiles use `a.category-card` with href="/kylma/.../c/NNN"
  // and text like "Magneettiventtiilit102 tuotetta".
  const links: CrawlSource[] = await page.$$eval(
    "a.category-card",
    (cards) => {
      const results: Array<{ path: string; categoryHint: string[] }> = [];
      for (let i = 0; i < cards.length; i++) {
        const href = cards[i].getAttribute("href");
        if (!href || !/\/c\/\d+/.test(href)) continue;
        const path = href.startsWith("/") ? href : "/" + href;
        const text = cards[i].textContent?.trim()
          .replace(/\s*\d+\s*tuotetta\s*/gi, "")
          .replace(/\s+/g, " ")
          .trim() ?? "";
        const name = text.split("\n")[0].trim().slice(0, 60);
        if (name) {
          results.push({ path, categoryHint: [name] });
        }
      }
      return results;
    }
  );
  return links;
}

// ─── Crawl a single listing page (with pagination) ─────────────────────────

async function crawlListingPage(
  page: Page,
  baseUrl: string,
  source: CrawlSource
): Promise<RawSupplierProduct[]> {
  const all: RawSupplierProduct[] = [];
  let pageNum = 1;

  while (pageNum <= MAX_PAGES) {
    const cards = await extractCardsFromPage(page);
    if (cards.length === 0) break;

    for (const card of cards) {
      if (!card.href) continue;
      const sourceUrl = resolveUrl(card.href, baseUrl) ?? "";
      const imgUrl = resolveUrl(card.imgSrc, baseUrl);
      all.push({
        supplier: "onninen",
        sku: skuFromUrl(card.href) ?? parseSkuText(card.skuText),
        name: card.name ?? undefined,
        manufacturer: card.brandAlt ?? undefined,
        categoryPath: source.categoryHint,
        sourceUrl,
        imageUrls: imgUrl ? [imgUrl] : []
      });
    }

    log(
      `  page ${pageNum}: ${cards.length} cards (total ${all.length})`
    );

    await sleep(PAGE_DELAY_MS);
    if (!(await clickNextPage(page))) {
      log(`  no more pages`);
      break;
    }
    pageNum++;
  }

  return all;
}

// ─── Crawl a single source path (with subcategory detection) ────────────────

async function crawlSource(
  page: Page,
  baseUrl: string,
  source: CrawlSource
): Promise<RawSupplierProduct[]> {
  const fullUrl = `${baseUrl}${source.path}`;
  log(`Crawling: ${source.path}`);
  await page.goto(fullUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
  await sleep(RENDER_WAIT_MS);

  // Check if page has product cards
  const cardCount = await page
    .locator(SEL.productCard)
    .count()
    .catch(() => 0);

  if (cardCount > 0) {
    // Direct product listing — paginate and extract
    return crawlListingPage(page, baseUrl, source);
  }

  // No product cards — check for subcategory links
  const subcategories = await detectSubcategoryLinks(page);
  if (subcategories.length === 0) {
    warn(`No products or subcategories at ${source.path}`);
    return [];
  }

  // Update subcategory hints with parent context
  for (const sub of subcategories) {
    sub.categoryHint = [...source.categoryHint, ...sub.categoryHint.filter(
      (h) => !source.categoryHint.includes(h)
    )];
  }

  log(
    `  Found ${subcategories.length} subcategories at ${source.path}, crawling each...`
  );

  const all: RawSupplierProduct[] = [];
  for (const sub of subcategories) {
    log(`  Subcategory: ${sub.path} [${sub.categoryHint.join(" > ")}]`);
    const subUrl = `${baseUrl}${sub.path}`;
    await page.goto(subUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });
    await sleep(RENDER_WAIT_MS);

    const products = await crawlListingPage(page, baseUrl, sub);
    all.push(...products);
    log(`    ${products.length} products`);
    await sleep(PAGE_DELAY_MS);
  }

  return all;
}

// ─── Detail page enrichment ─────────────────────────────────────────────────

async function enrichProduct(
  page: Page,
  product: RawSupplierProduct
): Promise<RawSupplierProduct> {
  if (!product.sourceUrl) return product;

  try {
    await page.goto(product.sourceUrl, {
      waitUntil: "domcontentloaded",
      timeout: 20_000
    });
    await sleep(DETAIL_DELAY_MS);

    // Extract detail data inside browser context.
    // Use $$eval on body to avoid tsx __name issues.
    const detail = await page.$$eval("body", (bodies, sel) => {
      const body = bodies[0];
      if (!body)
        return {
          h1: null as string | null,
          shortDesc: null as string | null,
          longDesc: null as string | null,
          crumbs: [] as string[],
          specs: null as Record<string, string> | null,
          images: [] as string[],
          brandAlt: null as string | null,
          priceText: null as string | null,
          lviCode: null as string | null
        };

      // H1
      const h1El = body.querySelector(sel.h1);
      const h1 = h1El?.textContent?.trim() ?? null;

      // Descriptions
      const shortEl = body.querySelector(sel.shortDesc);
      const shortDesc = shortEl?.textContent?.trim() ?? null;
      const longEl = body.querySelector(sel.longDesc);
      const longDesc = longEl?.textContent?.trim() ?? null;

      // Breadcrumbs
      const crumbEls = body.querySelectorAll(sel.breadcrumb);
      const crumbs = Array.from(crumbEls)
        .map((a) => a.textContent?.trim() ?? "")
        .filter(Boolean);

      // Specifications
      const specRows = body.querySelectorAll(sel.specRow);
      const specs: Record<string, string> = {};
      specRows.forEach((row) => {
        const label = row.querySelector(sel.specLabel);
        const value = row.querySelector(sel.specValue);
        const k = label?.textContent?.trim();
        const v = value?.textContent?.trim();
        if (k && v) specs[k] = v;
      });

      // Images (imgix)
      const imgEls = body.querySelectorAll(sel.productImage);
      const images = Array.from(imgEls)
        .map((img) => img.getAttribute("src") ?? "")
        .filter(Boolean);

      // Brand from first brand logo image (second imgix image usually)
      let brandAlt: string | null = null;
      for (let i = 0; i < imgEls.length; i++) {
        const alt = imgEls[i].getAttribute("alt")?.trim() ?? "";
        // Brand logos have short alt text (just brand name), product images are longer
        if (alt && alt.length < 30 && alt !== h1 && !alt.toLowerCase().includes(h1?.toLowerCase().slice(0, 10) ?? "___")) {
          brandAlt = alt;
          break;
        }
      }

      // Price (only visible when logged in)
      let priceText: string | null = null;
      const priceEls = body.querySelectorAll(sel.price);
      for (let i = 0; i < priceEls.length; i++) {
        const t = priceEls[i].textContent?.trim() ?? "";
        if (/\d+[,.]\d{2}/.test(t) && t.length < 30) {
          priceText = t;
          break;
        }
      }

      // LVI code from product codes section
      let lviCode: string | null = null;
      const codesDiv = body.querySelector(sel.productCodes);
      if (codesDiv) {
        const codeText = codesDiv.textContent ?? "";
        const m = codeText.match(/LVI\s*(\d+)/);
        if (m) lviCode = m[1];
      }

      return {
        h1,
        shortDesc,
        longDesc,
        crumbs,
        specs: Object.keys(specs).length > 0 ? specs : null,
        images,
        brandAlt,
        priceText,
        lviCode
      };
    }, {
      h1: SEL.detailH1,
      shortDesc: SEL.detailShortDesc,
      longDesc: SEL.detailLongDesc,
      breadcrumb: SEL.detailBreadcrumb,
      specRow: SEL.detailSpecRow,
      specLabel: SEL.detailSpecLabel,
      specValue: SEL.detailSpecValue,
      productImage: SEL.detailProductImage,
      productCodes: SEL.detailProductCodes,
      price: SEL.detailPrice
    });

    const base = new URL(page.url()).origin;

    // Breadcrumbs → categoryPath (skip "Etusivu" and product name)
    let categoryPath = product.categoryPath;
    if (detail.crumbs.length > 1) {
      const filtered = detail.crumbs.filter(
        (c) => !["etusivu", "home"].includes(c.toLowerCase())
      );
      if (filtered.length > 0) {
        categoryPath = filtered;
      }
    }

    // Images → resolve URLs, prefer product images over brand logos
    let imageUrls = product.imageUrls ?? [];
    if (detail.images.length > 0) {
      const resolved = detail.images
        .map((src) => resolveUrl(src, base))
        .filter((u): u is string => u !== null);
      if (resolved.length > 0) imageUrls = resolved;
    }

    // Description — prefer long, fallback to short
    const description =
      detail.longDesc ?? detail.shortDesc ?? product.description;

    return {
      ...product,
      name: detail.h1 ?? product.name,
      description,
      manufacturer:
        detail.brandAlt ?? product.manufacturer,
      categoryPath,
      priceText: detail.priceText ?? product.priceText,
      specs: detail.specs ?? product.specs,
      imageUrls
    };
  } catch (err) {
    warn(
      `Detail fetch failed for ${product.sku ?? product.sourceUrl}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    return product;
  }
}

// ─── Deduplication ──────────────────────────────────────────────────────────

function deduplicate(
  products: RawSupplierProduct[]
): RawSupplierProduct[] {
  const seen = new Map<string, RawSupplierProduct>();
  for (const p of products) {
    const key = p.sku?.trim().toUpperCase() || p.sourceUrl || "";
    if (!key) {
      seen.set(`__nokey_${seen.size}`, p);
      continue;
    }
    if (!seen.has(key)) seen.set(key, p);
  }
  return Array.from(seen.values());
}

// ─── Main export ────────────────────────────────────────────────────────────

export async function fetchOnninenRawProducts(
  config: ImporterConfig
): Promise<RawSupplierProduct[]> {
  if (config.useSampleData) {
    return ONNINEN_SAMPLE_PRODUCTS;
  }

  const baseUrl = config.onninen.baseUrl;
  const hasCredentials =
    !!config.onninen.username && !!config.onninen.password;

  log(
    `Starting live import (headless=${HEADLESS}, maxPages=${MAX_PAGES}, fetchDetails=${FETCH_DETAILS}, login=${hasCredentials}).`
  );
  if (!hasCredentials) {
    warn(
      "No ONNINEN_USERNAME/PASSWORD set. Prices will not be available — products without price will be skipped by normalization."
    );
  }

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: HEADLESS });
    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "fi-FI"
    });
    const page = await ctx.newPage();

    // 1) Dismiss cookies on first page load
    await page.goto(baseUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });
    await sleep(RENDER_WAIT_MS);
    await dismissCookies(page);

    // 2) Optional login
    if (hasCredentials) {
      await login(
        page,
        baseUrl,
        config.onninen.username,
        config.onninen.password
      );
    }

    // 3) Crawl all source paths (continue on per-source failures)
    const all: RawSupplierProduct[] = [];
    for (const source of CRAWL_SOURCES) {
      try {
        const products = await crawlSource(page, baseUrl, source);
        all.push(...products);
        log(`  ${source.path}: ${products.length} products`);
      } catch (err) {
        warn(
          `Failed to crawl ${source.path}: ${
            err instanceof Error ? err.message : String(err)
          }. Continuing with next source.`
        );
      }
    }

    log(`Total raw products: ${all.length}`);

    // 4) Deduplicate
    const unique = deduplicate(all);
    log(`Deduplicated: ${all.length} -> ${unique.length} unique products.`);

    // 5) Optional detail enrichment
    if (FETCH_DETAILS && unique.length > 0) {
      log(`Enriching ${unique.length} products from detail pages...`);
      const enriched: RawSupplierProduct[] = [];
      for (let i = 0; i < unique.length; i++) {
        enriched.push(await enrichProduct(page, unique[i]));
        if ((i + 1) % 20 === 0)
          log(`  enriched ${i + 1}/${unique.length}`);
      }
      log("Enrichment done.");
      await browser.close();
      return enriched;
    }

    await browser.close();
    return unique;
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    throw err;
  }
}
