# Supplier Importer

This project includes importers for:

- Ahlsell (`scripts/importers/suppliers/ahlsell.ts`) — **live scraper implemented**
- Onninen (`scripts/importers/suppliers/onninen.ts`) — **live scraper implemented**

## Setup

Install Playwright browsers (one-time, after `npm install`):

```bash
npx playwright install chromium
```

## Run commands

- `npm run import:ahlsell`
- `npm run import:onninen`
- `npm run import:all`

Optional flags:

- `--dry-run` force dry run output
- `--sample` force sample supplier payloads

Example:

```bash
npm run import:all -- --dry-run --sample
```

## Normalization and pricing

The mapping layer is in `scripts/importers/mapping/normalize.ts`.

Rules:

- Source prices are treated as `0 ALV` (ex VAT).
- Import applies `25% kate` by default.
- Sell ex-VAT price formula: `sourcePriceExVat * (1 + markupPercent / 100)`.

Stored fields:

- `Product.sourcePriceExVat` = supplier cost (0 ALV)
- `Product.markupPercent` = margin percentage (default 25)
- `Product.priceExVat` = final sale price excluding VAT
- `Product.vatRate` = default 25.5

## Ahlsell live scraper

The Ahlsell importer uses Playwright (headless Chromium) to:

1. **Login** at `AHLSELL_LOGIN_URL` with `AHLSELL_USERNAME` / `AHLSELL_PASSWORD`.
2. **Navigate** to `AHLSELL_SEARCH_URL`.
3. **Paginate** through all result pages, extracting product cards on each page.
4. **Deduplicate** by SKU (fallback: sourceUrl).
5. **Enrich** each product by visiting its detail page (description, manufacturer, breadcrumb category, specs table, gallery images).

### Selector strategy

Each extraction point has an ordered list of CSS selector candidates. The scraper tries each in order and uses the first that matches. This survives minor site redesigns without code changes. Selectors are defined in the `CSS` and `PW_FALLBACKS` objects at the top of `ahlsell.ts`.

Card extraction runs entirely inside `page.$$eval()` (browser context) for speed — one round-trip per page instead of one per card.

### Environment knobs

| Variable | Default | Description |
|---|---|---|
| `AHLSELL_HEADLESS` | `true` | Run browser headlessly |
| `AHLSELL_MAX_PAGES` | `50` | Stop pagination after N pages |
| `AHLSELL_PAGE_DELAY_MS` | `1500` | Delay between page navigations |
| `AHLSELL_FETCH_DETAILS` | `true` | Visit each product detail page |
| `AHLSELL_DETAIL_DELAY_MS` | `800` | Delay before scraping detail page |
| `AHLSELL_LOGIN_URL` | `https://www.ahlsell.fi/kirjaudu` | Login page URL |

### Remaining TODOs (Ahlsell)

- Add retry/backoff on transient network errors
- Add diff tracking for updated/removed supplier products
- Consider cookie/session caching to skip login on repeated runs

## Onninen live scraper

The Onninen importer uses Playwright (headless Chromium) to:

1. **Navigate** to `ONNINEN_BASE_URL` and dismiss cookie consent.
2. **Login** (optional) with `ONNINEN_USERNAME` / `ONNINEN_PASSWORD` — prices require login.
3. **Crawl** 6 sources: 4 category paths + 2 search terms.
4. **Detect subcategories** — if a category page shows subcategory tiles instead of product cards, automatically follows each subcategory link.
5. **Paginate** through product listing pages using the next-page button.
6. **Deduplicate** by SKU (fallback: sourceUrl).
7. **Enrich** each product by visiting its detail page (breadcrumb category, description, specifications, images, LVI code).

### Selector strategy (Onninen)

CSS selectors are defined in the `SEL` object at the top of `onninen.ts`, tuned against the live onninen.fi site (Feb 2026):

- **Product cards**: `div.product-card` wrapper, `a.product-card-grid__product-title` for title/link, `div.short-product-codes` for SKU, `div.product-card-grid__brand-header img` for brand.
- **Pagination**: `a.test-next-page-button`.
- **Login**: `#accountId`, `#password`, `button.test-login__submit`.
- **Detail page**: `a.breadcrumb__link` (category), `div.specification-row` (specs), `div.test-product__short-description` / `div.long-description` (description), `img.imgix-image` (images).
- **Cookie consent**: `#kconsent-accept-all`.

Card extraction runs inside `page.$$eval()` (browser context) for speed.

### Crawl sources

| Path | Category hint |
|---|---|
| `/kylma/venttiilit/c/777` | Kylmä > Venttiilit (+ subcategories) |
| `/kylma/kylman-asennustarvikkeet/c/787` | Kylmä > Asennustarvikkeet (+ subcategories) |
| `/kylma/kylmaaineet-ja-lammonsiirtonesteet/c/797` | Kylmä > Kylmäaineet (+ subcategories) |
| `/kylma/ohjaus-ja-valvonta/c/803` | Kylmä > Ohjaus ja Valvonta (+ subcategories) |
| `/search?term=asennuskanava` | Asennuskanava |
| `/search?term=suojakouru` | Suojakouru |

### Environment knobs (Onninen)

| Variable | Default | Description |
|---|---|---|
| `ONNINEN_BASE_URL` | `https://www.onninen.fi` | Site base URL |
| `ONNINEN_USERNAME` | (empty) | Login email (optional, needed for prices) |
| `ONNINEN_PASSWORD` | (empty) | Login password (optional) |
| `ONNINEN_HEADLESS` | `true` | Run browser headlessly |
| `ONNINEN_MAX_PAGES` | `20` | Max pagination pages per source |
| `ONNINEN_PAGE_DELAY_MS` | `1500` | Delay between page navigations |
| `ONNINEN_FETCH_DETAILS` | `true` | Visit each product detail page |
| `ONNINEN_DETAIL_DELAY_MS` | `800` | Delay before scraping detail page |
| `ONNINEN_RENDER_WAIT_MS` | `3000` | Wait after page load for JS rendering |

### Remaining TODOs (Onninen)

- Obtain Onninen credentials to enable price scraping
- Add retry/backoff on transient network errors
- Add diff tracking for updated/removed supplier products
