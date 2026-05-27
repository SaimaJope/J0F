import { chromium, Browser, Page, Locator } from "playwright";
import { ImporterConfig, RawSupplierProduct } from "../types";

// ─── Sample data (unchanged) ────────────────────────────────────────────────

const AHLSELL_SAMPLE_PRODUCTS: RawSupplierProduct[] = [
  {
    supplier: "ahlsell",
    sku: "AHL-INN-001",
    name: "INNOVA Painesaadinventtiili 1/2",
    description: "Esimerkkituote skeleton-importille.",
    manufacturer: "INNOVA",
    categoryPath: ["INNOVA Products", "Venttiilit"],
    sourceUrl: "https://www.ahlsell.fi/example/ahl-inn-001",
    imageUrls: ["https://www.ahlsell.fi/images/ahl-inn-001.jpg"],
    priceExVat: 129.5,
    specs: { connection: "1/2", pressureClass: "PN16" }
  },
  {
    supplier: "ahlsell",
    sku: "AHL-INN-002",
    name: "INNOVA Kuivainsuodatin DF-083",
    description: "Toinen esimerkkituote skeleton-importille.",
    manufacturer: "INNOVA",
    categoryPath: ["INNOVA Products", "Asennustarvikkeet"],
    sourceUrl: "https://www.ahlsell.fi/example/ahl-inn-002",
    imageUrls: ["https://www.ahlsell.fi/images/ahl-inn-002.jpg"],
    priceText: "48,90 €",
    specs: { refrigerant: "R134a / R404A", diameter: "3/8" }
  }
];

// ─── Runtime knobs (env vars, not part of ImporterConfig) ───────────────────

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key]?.trim().toLowerCase();
  if (!v) return fallback;
  return v === "true" || v === "1" || v === "yes";
}

function envInt(key: string, fallback: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : fallback;
}

const HEADLESS = envBool("AHLSELL_HEADLESS", true);
const MAX_PAGES = envInt("AHLSELL_MAX_PAGES", 50);
const PAGE_DELAY_MS = envInt("AHLSELL_PAGE_DELAY_MS", 1500);
const FETCH_DETAILS = envBool("AHLSELL_FETCH_DETAILS", true);
const DETAIL_DELAY_MS = envInt("AHLSELL_DETAIL_DELAY_MS", 800);
const RENDER_WAIT_MS = envInt("AHLSELL_RENDER_WAIT_MS", 3000);

// ─── Selector strategy ─────────────────────────────────────────────────────
// Tuned against live ahlsell.fi (Feb 2026).
// The site uses Tailwind utility classes.  Selectors use the stable
// semantic/BEM-ish classes where available and fall back to generic CSS.

const CSS = {
  // Login page – Ahlsell uses capital-U/P field names, duplicate IDs
  // in header (hidden) and main form (visible).
  usernameInput: [
    "#Username",
    'input[name="Username"]',
    'input[name="username"]'
  ],
  passwordInput: [
    "#Password",
    'input[name="Password"]',
    'input[name="password"]'
  ],
  loginSubmit: [
    "button.jsLogin",
    'button[type="submit"]'
  ],
  // Cookie consent (OneTrust)
  cookieAccept: [
    "#onetrust-accept-btn-handler",
    "#accept-recommended-btn-handler"
  ],

  // Search results – each product is an <a href="/products/..."> card
  productCard: [
    'a[href^="/products/"]'
  ],

  // Inside a product card (standard CSS only – used in $$eval browser ctx)
  cardName: ".text-card-item-name",
  cardBrand: ".text-card-brand",
  cardSku: ".text-card-item-number",
  cardDesc: ".text-card-description",

  // Detail page
  detailPrice: [
    "p.text-heading-h3",
    '[class*="price"]'
  ],
  detailH1: "h1",
  detailCrumb: [
    ".breadcrumb a",
    'nav[aria-label="Breadcrumb"] a',
    'nav a[href^="/products/"]'
  ],
  detailSpecs: [
    "table",
    ".specifications table",
    ".product-specs table"
  ],
  detailImgs: [
    ".product-gallery img",
    ".product-images img",
    "img[src*='external-assets']"
  ],

  // Pagination
  nextPage: [
    'a[rel="next"]',
    '[aria-label="Next"]',
    ".pagination .next a"
  ]
} as const;

// Playwright pseudo-selectors (:has-text) – only usable with page.$()
const PW_FALLBACKS = {
  loginSubmit: [
    'button:has-text("Kirjaudu")',
    'button:has-text("Login")'
  ],
  nextPage: [
    'a:has-text("Seuraava")',
    'button:has-text("Seuraava")',
    'a:has-text("Next")'
  ]
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[ahlsell] ${msg}`);
}
function warn(msg: string) {
  console.warn(`[ahlsell] WARN: ${msg}`);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Try each Playwright selector, return the first that resolves an element. */
async function pwFirst(
  page: Page,
  selectors: readonly string[]
): Promise<string | null> {
  for (const sel of selectors) {
    if (await page.$(sel).catch(() => null)) return sel;
  }
  return null;
}

/** Try each selector, return the first Locator that is visible on the page. */
async function firstVisibleLocator(
  page: Page,
  selectors: readonly string[]
): Promise<Locator | null> {
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel);
      const count = await loc.count();
      for (let i = 0; i < count; i++) {
        if (await loc.nth(i).isVisible({ timeout: 500 }).catch(() => false)) {
          return loc.nth(i);
        }
      }
    } catch {
      // selector invalid or not found
    }
  }
  return null;
}

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

/** Parse SKU from "Tuotenumero: 7687072" → "7687072" */
function parseSku(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(/(\d{5,})/);
  return m ? m[1] : raw.replace(/[^a-zA-Z0-9-]/g, "").trim() || undefined;
}

/** Parse category path from URL like /products/kylma/lampopumput/ilma--ilma/innova/7687072 */
function categoryFromUrl(href: string): string[] | undefined {
  try {
    const path = new URL(href, "https://www.ahlsell.fi").pathname;
    const segments = path.split("/").filter(Boolean);
    // /products/cat1/cat2/.../sku-slug → take segments between "products" and the last one
    if (segments[0] === "products" && segments.length >= 3) {
      return segments.slice(1, -1).map((s) =>
        s.replace(/--/g, "/").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      );
    }
  } catch { /* ignore */ }
  return undefined;
}

// ─── Login ──────────────────────────────────────────────────────────────────

async function login(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  const loginUrl =
    process.env.AHLSELL_LOGIN_URL?.trim() ||
    "https://www.ahlsell.fi/my-pages/";

  log(`Navigating to login: ${loginUrl}`);
  await page.goto(loginUrl, { waitUntil: "networkidle", timeout: 30_000 });

  // Dismiss cookie consent banner if present
  const cookieSel = await pwFirst(page, CSS.cookieAccept);
  if (cookieSel) {
    log("Dismissing cookie consent banner...");
    await page.click(cookieSel).catch(() => {});
    await sleep(1000);
  }

  // Username — use firstVisibleLocator to skip hidden header duplicate
  const userLoc = await firstVisibleLocator(page, CSS.usernameInput);
  if (!userLoc) throw new Error("Cannot find username input on login page.");
  await userLoc.fill(username);
  log("Filled username.");

  // Password
  const passLoc = await firstVisibleLocator(page, CSS.passwordInput);
  if (!passLoc) throw new Error("Cannot find password input on login page.");
  await passLoc.fill(password);
  log("Filled password.");

  // Submit
  const submitLoc =
    (await firstVisibleLocator(page, CSS.loginSubmit)) ??
    (await firstVisibleLocator(page, PW_FALLBACKS.loginSubmit));
  if (!submitLoc) throw new Error("Cannot find login submit button.");
  await submitLoc.click();

  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => warn("Network didn't fully settle after login."));
  // Extra wait for JS-rendered page to update
  await sleep(2000);

  // Verify login succeeded: check if login form is still visible
  const stillOnLogin = await firstVisibleLocator(page, CSS.usernameInput);
  if (stillOnLogin) {
    throw new Error(
      "Login failed – login form still visible after submit. Check credentials."
    );
  }

  log("Login OK.");
}

// ─── Card extraction (runs in browser context via $$eval) ───────────────────

interface RawCardData {
  name: string | null;
  brand: string | null;
  sku: string | null;
  description: string | null;
  imgSrc: string | null;
  href: string | null;
}

async function extractCards(page: Page): Promise<RawSupplierProduct[]> {
  const cardSel = CSS.productCard[0]; // 'a[href^="/products/"]'
  const count = await page.locator(cardSel).count().catch(() => 0);
  if (count === 0) {
    warn("No product cards found on this page.");
    return [];
  }
  log(`${count} product cards found.`);

  // NOTE: All logic inside $$eval runs in the browser context.
  // Avoid const arrow-function assignments — tsx injects __name() which
  // doesn't exist in the browser.  Inline all helpers directly.
  const raw: RawCardData[] = await page.$$eval(
    cardSel,
    (cards, sels) => {
      return cards.map((card) => {
        // Text content of a child by selector
        let name: string | null = null;
        const nameEl = card.querySelector(sels.name);
        if (nameEl?.textContent?.trim()) name = nameEl.textContent.trim();

        let brand: string | null = null;
        const brandEl = card.querySelector(sels.brand);
        if (brandEl?.textContent?.trim()) brand = brandEl.textContent.trim();

        let skuText: string | null = null;
        const skuEl = card.querySelector(sels.sku);
        if (skuEl?.textContent?.trim()) skuText = skuEl.textContent.trim();

        let description: string | null = null;
        const descEl = card.querySelector(sels.desc);
        if (descEl?.textContent?.trim()) description = descEl.textContent.trim();

        let imgSrc: string | null = null;
        const img = card.querySelector("img");
        if (img) imgSrc = img.getAttribute("src") ?? img.getAttribute("data-src");

        return {
          name,
          brand,
          sku: skuText,
          description,
          imgSrc: imgSrc?.trim() ?? null,
          href: card.getAttribute("href")
        };
      });
    },
    {
      name: CSS.cardName,
      brand: CSS.cardBrand,
      sku: CSS.cardSku,
      desc: CSS.cardDesc
    }
  );

  const base = new URL(page.url()).origin;
  return raw
    .filter((r) => r.href) // skip cards without links
    .map((r) => {
      const sourceUrl = resolveUrl(r.href, base) ?? "";
      const imgUrl = resolveUrl(r.imgSrc, base);
      return {
        supplier: "ahlsell" as const,
        sku: parseSku(r.sku),
        name: r.name ?? undefined,
        description: r.description ?? undefined,
        manufacturer: r.brand ?? undefined,
        categoryPath: categoryFromUrl(sourceUrl),
        sourceUrl,
        imageUrls: imgUrl ? [imgUrl] : []
      };
    });
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

    // Extract detail data entirely inside browser context.
    // Avoid named const arrow functions (tsx __name bug).
    const detail = await page.$$eval("body", (bodies, sels) => {
      const body = bodies[0];
      if (!body) return { price: null, h1: null, crumbs: [] as string[], specs: null as Record<string, string> | null, images: [] as string[] };

      // Price
      let price: string | null = null;
      for (let i = 0; i < sels.price.length; i++) {
        const el = body.querySelector(sels.price[i]);
        if (el?.textContent?.trim()) { price = el.textContent.trim(); break; }
      }

      // H1
      const h1El = body.querySelector(sels.h1);
      const h1 = h1El?.textContent?.trim() ?? null;

      // Breadcrumbs
      let crumbs: string[] = [];
      for (let i = 0; i < sels.crumb.length; i++) {
        const els = body.querySelectorAll(sels.crumb[i]);
        if (els.length > 0) {
          crumbs = Array.from(els).map((e) => e.textContent?.trim() ?? "").filter(Boolean);
          break;
        }
      }

      // Specs table
      const specs: Record<string, string> = {};
      for (let i = 0; i < sels.specs.length; i++) {
        const table = body.querySelector(sels.specs[i]);
        if (table) {
          table.querySelectorAll("tr").forEach((row) => {
            const cells = row.querySelectorAll("th, td");
            if (cells.length >= 2) {
              const k = cells[0].textContent?.trim();
              const v = cells[1].textContent?.trim();
              if (k && v) specs[k] = v;
            }
          });
          break;
        }
      }

      // Images
      let images: string[] = [];
      for (let i = 0; i < sels.imgs.length; i++) {
        const imgs = body.querySelectorAll(sels.imgs[i]);
        if (imgs.length > 0) {
          images = Array.from(imgs)
            .map((img) => img.getAttribute("src") ?? "")
            .filter(Boolean);
          break;
        }
      }

      return {
        price,
        h1,
        crumbs,
        specs: Object.keys(specs).length > 0 ? specs : null,
        images
      };
    }, {
      price: [...CSS.detailPrice],
      h1: CSS.detailH1,
      crumb: [...CSS.detailCrumb],
      specs: [...CSS.detailSpecs],
      imgs: [...CSS.detailImgs]
    });

    const base = new URL(page.url()).origin;

    // Process breadcrumbs → categoryPath
    let categoryPath = product.categoryPath;
    if (detail.crumbs.length > 0) {
      const filtered = detail.crumbs.filter(
        (c) =>
          !["etusivu", "home", "ahlsell", "haku"].includes(c.toLowerCase())
      );
      if (filtered.length > 1) {
        categoryPath = filtered.slice(0, -1);
      } else if (filtered.length === 1) {
        categoryPath = filtered;
      }
    }

    // Process detail images
    let imageUrls = product.imageUrls ?? [];
    if (detail.images.length > 0) {
      const resolved = detail.images
        .map((src) => resolveUrl(src, base))
        .filter((u): u is string => u !== null);
      if (resolved.length > 0) imageUrls = resolved;
    }

    return {
      ...product,
      name: detail.h1 ?? product.name,
      priceText: detail.price ?? product.priceText,
      manufacturer: product.manufacturer,
      categoryPath,
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

// ─── Pagination ─────────────────────────────────────────────────────────────

async function clickNextPage(page: Page): Promise<boolean> {
  const allSels: string[] = [...CSS.nextPage, ...PW_FALLBACKS.nextPage];
  const sel = await pwFirst(page, allSels);
  if (!sel) return false;

  const el = await page.$(sel);
  if (!el) return false;

  const disabled = await el.getAttribute("disabled").catch(() => null);
  const ariaDis = await el.getAttribute("aria-disabled").catch(() => null);
  const cls = (await el.getAttribute("class").catch(() => "")) ?? "";
  if (disabled !== null || ariaDis === "true" || cls.includes("disabled")) {
    return false;
  }

  try {
    await el.click();
    await page
      .waitForLoadState("domcontentloaded", { timeout: 15_000 })
      .catch(() => {});
    await sleep(RENDER_WAIT_MS);
    return true;
  } catch {
    return false;
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

export async function fetchAhlsellRawProducts(
  config: ImporterConfig
): Promise<RawSupplierProduct[]> {
  if (config.useSampleData) {
    return AHLSELL_SAMPLE_PRODUCTS;
  }

  if (!config.ahlsell.username || !config.ahlsell.password) {
    throw new Error(
      "AHLSELL_USERNAME and AHLSELL_PASSWORD are required when IMPORT_USE_SAMPLE_DATA=false."
    );
  }

  log(
    `Starting live import (headless=${HEADLESS}, maxPages=${MAX_PAGES}, fetchDetails=${FETCH_DETAILS}).`
  );

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: HEADLESS });
    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "fi-FI"
    });
    const page = await ctx.newPage();

    // 1) Login
    await login(page, config.ahlsell.username, config.ahlsell.password);

    // 2) Navigate to search page (use domcontentloaded — networkidle hangs)
    log(`Opening search: ${config.ahlsell.searchUrl}`);
    await page.goto(config.ahlsell.searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });
    await sleep(RENDER_WAIT_MS);

    // 3) Paginate & extract cards
    const all: RawSupplierProduct[] = [];
    let pageNum = 1;

    while (pageNum <= MAX_PAGES) {
      log(`Page ${pageNum} ...`);
      const cards = await extractCards(page);
      all.push(...cards);
      log(`  -> ${cards.length} products (total ${all.length})`);

      if (cards.length === 0) break;

      await sleep(PAGE_DELAY_MS);
      if (!(await clickNextPage(page))) {
        log("No more pages.");
        break;
      }
      pageNum++;
    }

    if (pageNum > MAX_PAGES) warn(`Hit MAX_PAGES limit (${MAX_PAGES}).`);

    // 4) Deduplicate by SKU, fallback sourceUrl
    const unique = deduplicate(all);
    log(`Deduplicated: ${all.length} -> ${unique.length} unique products.`);

    // 5) Optional: enrich from detail pages (price, specs, better images)
    if (FETCH_DETAILS && unique.length > 0) {
      log(`Enriching ${unique.length} products from detail pages...`);
      const enriched: RawSupplierProduct[] = [];
      for (let i = 0; i < unique.length; i++) {
        enriched.push(await enrichProduct(page, unique[i]));
        if ((i + 1) % 10 === 0) log(`  enriched ${i + 1}/${unique.length}`);
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
