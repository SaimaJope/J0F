# Claude Handoff (Updated: February 6, 2026)

This file summarizes exactly what was implemented in this session so another agent can continue without re-discovery.

## What was created

- Next.js/TypeScript/Tailwind project scaffold.
- Prisma setup and base domain schema.
- Supplier importer skeletons (Ahlsell + Onninen).
- Shared normalization and persistence pipeline.
- Import command scripts and docs.
- **Live Ahlsell scraper** (Playwright-based, replaces skeleton TODO).

## Key business rules implemented

- Supplier source prices are treated as **0 ALV** (ex VAT cost).
- Every imported product gets **25% kate** by default.
- Formula used in normalization:
  - `priceExVat = sourcePriceExVat * 1.25`
- Stored in DB fields:
  - `Product.sourcePriceExVat`
  - `Product.markupPercent`
  - `Product.priceExVat`
  - `Product.vatRate` (default 25.5)

## Files added/changed

### Core scaffold

- `package.json` (scripts + deps for app, prisma, tsx importer runner, **playwright**)
- `README.md`
- `.env.example`
- `.gitignore`
- `tsconfig.json`
- `next.config.ts`
- `postcss.config.mjs`
- `tailwind.config.ts`
- `.eslintrc.json`
- `next-env.d.ts`
- `app/layout.tsx`
- `app/page.tsx`
- `app/globals.css`
- `lib/prisma.ts`
- `docs/phase1-foundation-checklist.md`

### Prisma

- `prisma/schema.prisma`
  - Added `sourcePriceExVat Decimal(10,2)`
  - Added `markupPercent Decimal(5,2) @default(25.00)`
  - Existing `priceExVat`, `vatRate`, supplier/category/manufacturer/order models retained

### Importer system

- `scripts/importers/types.ts`
- `scripts/importers/utils.ts`
- `scripts/importers/config.ts`
- `scripts/importers/mapping/normalize.ts`
- `scripts/importers/persist.ts`
- `scripts/importers/run.ts`
- `scripts/importers/run-ahlsell.ts`
- `scripts/importers/run-onninen.ts`
- `scripts/importers/run-all.ts`
- `scripts/importers/suppliers/ahlsell.ts` — **live Playwright scraper**
- `scripts/importers/suppliers/onninen.ts` — **live Playwright scraper**
- `docs/importer-skeleton.md`

## NPM scripts available

- `npm run import:ahlsell`
- `npm run import:onninen`
- `npm run import:all`

Optional runtime flags:

- `--dry-run`
- `--sample`

Example:

```bash
npm run import:all -- --dry-run --sample
```

## Ahlsell live scraper details

Located in `scripts/importers/suppliers/ahlsell.ts`.

### How it works

1. Launches headless Chromium via Playwright.
2. Logs in using `AHLSELL_USERNAME` / `AHLSELL_PASSWORD` at `AHLSELL_LOGIN_URL`.
3. Navigates to `AHLSELL_SEARCH_URL`.
4. Paginates through search results, extracting product cards via `page.$$eval()`.
5. Deduplicates by SKU (fallback: sourceUrl).
6. Optionally enriches each product from its detail page (description, manufacturer, breadcrumb category, specs table, gallery images).

### Selector strategy

- Multiple CSS selector candidates per element, tried in order (most-specific first).
- Standard CSS selectors for browser-context `$$eval` (card extraction, detail pages).
- Playwright pseudo-selectors (`:has-text()`) as fallbacks for login and pagination buttons.
- All selectors defined in `CSS` and `PW_FALLBACKS` objects at module top.

### Environment knobs

| Variable | Default | Description |
|---|---|---|
| `AHLSELL_HEADLESS` | `true` | Run Chromium headlessly |
| `AHLSELL_MAX_PAGES` | `50` | Max pagination pages |
| `AHLSELL_PAGE_DELAY_MS` | `1500` | Rate-limit delay between pages |
| `AHLSELL_FETCH_DETAILS` | `true` | Visit product detail pages |
| `AHLSELL_DETAIL_DELAY_MS` | `800` | Delay before scraping detail |
| `AHLSELL_LOGIN_URL` | `https://www.ahlsell.fi/kirjaudu` | Login page URL |

### Setup requirement

After `npm install`, run once:

```bash
npx playwright install chromium
```

## Current importer status

- End-to-end pipeline is runnable.
- Sample supplier payloads are included for Ahlsell and Onninen.
- Normalization, pricing, and DB upsert logic are implemented.
- **Ahlsell live scraper is implemented** (selectors tuned against live site, Feb 2026).
- **Onninen live scraper is implemented** (selectors tuned against live site, Feb 2026; login optional, needed for prices).

## Validation that was run

- `npm install` ✅
- `npm run db:generate` ✅
- `npm run import:all -- --dry-run --sample` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Environment knobs for importer

Defined in `.env.example`:

- `IMPORT_DRY_RUN`
- `IMPORT_USE_SAMPLE_DATA`
- `IMPORT_MARKUP_PERCENT` (default `25`)
- `IMPORT_DEFAULT_VAT_RATE` (default `25.5`)
- `AHLSELL_SEARCH_URL`
- `AHLSELL_USERNAME`
- `AHLSELL_PASSWORD`
- `AHLSELL_LOGIN_URL`
- `AHLSELL_HEADLESS`
- `AHLSELL_MAX_PAGES`
- `AHLSELL_PAGE_DELAY_MS`
- `AHLSELL_FETCH_DETAILS`
- `AHLSELL_DETAIL_DELAY_MS`
- `ONNINEN_BASE_URL`
- `ONNINEN_USERNAME`
- `ONNINEN_PASSWORD`
- `ONNINEN_HEADLESS`
- `ONNINEN_MAX_PAGES`
- `ONNINEN_PAGE_DELAY_MS`
- `ONNINEN_FETCH_DETAILS`
- `ONNINEN_DETAIL_DELAY_MS`

## Onninen live scraper details

Located in `scripts/importers/suppliers/onninen.ts`.

### How it works

1. Launches headless Chromium via Playwright.
2. Dismisses cookie consent (`#kconsent-accept-all`).
3. Optionally logs in using `ONNINEN_USERNAME` / `ONNINEN_PASSWORD` (needed for prices).
4. Crawls 6 sources: 4 category paths + 2 search terms.
5. Detects subcategory pages (pages with subcategory tiles instead of products) and follows them automatically.
6. Paginates through product listings using `a.test-next-page-button`.
7. Deduplicates by SKU (fallback: sourceUrl).
8. Optionally enriches each product from detail pages (breadcrumbs, descriptions, specs, images).

### Key selectors (tuned Feb 2026)

- Cards: `div.product-card`, `a.product-card-grid__product-title`, `div.short-product-codes`, `div.product-card-grid__brand-header`
- Pagination: `a.test-next-page-button`
- Login: `#accountId`, `#password`, `button.test-login__submit`
- Detail: `a.breadcrumb__link`, `div.specification-row`, `div.test-product__short-description`, `div.long-description`, `img.imgix-image`

### Important notes

- **Prices require login** — without `ONNINEN_USERNAME`/`ONNINEN_PASSWORD`, products are scraped but normalization skips them (no price = skip).
- **Category pages** at paths like `/kylma/venttiilit/c/777` show subcategory tiles, not products directly. The scraper auto-detects this and follows subcategory links.
- **tsx `__name` bug** applies here too: avoid `const fn = () => {}` patterns inside `page.evaluate()`/`page.$$eval()` callbacks.

## Important implementation note

Prisma is pinned to `6.16.0` with `confbox` override `0.2.2` in `package.json` to avoid a generator/runtime issue seen with newer combinations in this environment.

## Suggested next steps for Claude

1. Obtain Onninen credentials and test with login to get prices.
2. Add retry/backoff for transient network failures.
3. Add import audit logging table (run id, counts, errors, duration).
4. Add scheduler/manual admin trigger for recurring imports.
5. Build `/tuotteet` Prisma-backed catalog page and API query endpoint.
