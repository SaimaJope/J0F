# JobFuture Wholesale Catalog

This repository contains the implementation foundation for the JobFuture B2B wholesale catalog project.

## Scope of this foundation

- Next.js 15 + React 19 + TypeScript app scaffold
- Tailwind CSS setup with baseline brand theme
- Prisma data model for products, categories, manufacturers, and orders
- Initial landing page that reflects proposal goals
- Phase 1 checklist for execution

## Quick start

1. Install dependencies:
   - `npm install`
2. Create local environment:
   - copy `.env.example` to `.env`
3. Generate Prisma client:
   - `npm run db:generate`
4. Start development:
   - `npm run dev`

## Scripts

- `npm run dev` - run local development server
- `npm run build` - create production build
- `npm run start` - run production server
- `npm run lint` - lint project
- `npm run db:generate` - generate Prisma client
- `npm run db:push` - push schema to database
- `npm run db:studio` - open Prisma Studio
- `npm run import:ahlsell` - run Ahlsell importer
- `npm run import:onninen` - run Onninen importer
- `npm run import:all` - run both suppliers

## Pricing rule in importer

Importer normalization enforces:

- Supplier prices are treated as `0 ALV` (source ex VAT).
- Sales price is computed with `25% kate` by default.
- Formula: `priceExVat = sourcePriceExVat * 1.25`

You can adjust markup with `IMPORT_MARKUP_PERCENT` in `.env`.

## Contact form email

The contact form sends messages through the Resend Email API from the server-side
`/api/contact` route. Set these environment variables locally and in Render:

- `RESEND_API_KEY` - Resend API key with send permissions
- `CONTACT_FROM_EMAIL` - verified sender address, for example `JobFuture <noreply@jobkauppa.fi>`
- `CONTACT_TO_EMAIL` - inbox that receives form messages, defaults to `info@jobkauppa.fi`

The sending domain must be verified in Resend before production delivery works.

## Structure

- `app/` - Next.js App Router UI
- `lib/` - shared server/client utilities
- `prisma/` - database schema
- `docs/` - implementation notes
