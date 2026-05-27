import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { NormalizedProduct } from "./types";
import { moneyString, slugify } from "./utils";

export interface PersistOptions {
  dryRun: boolean;
}

export interface PersistResult {
  persistedCount: number;
}

function categorySlug(pathSegments: string[]): string {
  return slugify(pathSegments.join("-"));
}

async function ensureCategoryPath(
  prisma: PrismaClient,
  categoryPath: string[]
): Promise<string> {
  let parentId: string | null = null;
  const traversed: string[] = [];

  for (const segment of categoryPath) {
    traversed.push(segment);
    const slug = categorySlug(traversed);

    const categoryRow: { id: string } = await prisma.category.upsert({
      where: { slug },
      create: {
        name: segment,
        slug,
        parentId
      },
      update: {
        name: segment,
        parentId
      },
      select: {
        id: true
      }
    });

    parentId = categoryRow.id;
  }

  if (!parentId) {
    throw new Error("Category path resolution failed.");
  }

  return parentId;
}

async function ensureManufacturer(
  prisma: PrismaClient,
  manufacturer: string | null
): Promise<string | null> {
  if (!manufacturer) {
    return null;
  }

  const name = manufacturer.trim();
  if (!name) {
    return null;
  }

  const row = await prisma.manufacturer.upsert({
    where: { slug: slugify(name) },
    create: {
      name,
      slug: slugify(name)
    },
    update: {
      name
    },
    select: {
      id: true
    }
  });

  return row.id;
}

function summarizeDryRun(products: NormalizedProduct[]): void {
  console.log(`[dry-run] normalized products: ${products.length}`);
  const preview = products.slice(0, 5);
  for (const product of preview) {
    console.log(
      `[dry-run] ${product.sku} | ${product.source} | cost 0% ALV ${moneyString(
        product.sourcePriceExVat
      )} -> sell ex VAT ${moneyString(product.priceExVat)} (markup ${product.markupPercent}%)`
    );
  }
}

export async function persistNormalizedProducts(
  products: NormalizedProduct[],
  options: PersistOptions
): Promise<PersistResult> {
  if (products.length === 0) {
    return { persistedCount: 0 };
  }

  if (options.dryRun) {
    summarizeDryRun(products);
    return { persistedCount: products.length };
  }

  const { prisma } = await import("../../lib/prisma");

  for (const product of products) {
    const categoryId = await ensureCategoryPath(prisma, product.categoryPath);
    const manufacturerId = await ensureManufacturer(prisma, product.manufacturer);

    await prisma.$transaction(async (tx) => {
      const upserted = await tx.product.upsert({
        where: { sku: product.sku },
        create: {
          name: product.name,
          sku: product.sku,
          description: product.description,
          sourcePriceExVat: new Prisma.Decimal(moneyString(product.sourcePriceExVat)),
          markupPercent: new Prisma.Decimal(moneyString(product.markupPercent)),
          priceExVat: new Prisma.Decimal(moneyString(product.priceExVat)),
          vatRate: new Prisma.Decimal(moneyString(product.vatRate)),
          source: product.source,
          sourceUrl: product.sourceUrl,
          specifications: product.specifications as Prisma.InputJsonValue,
          lastScrapedAt: product.lastScrapedAt,
          categoryId,
          manufacturerId
        },
        update: {
          name: product.name,
          description: product.description,
          sourcePriceExVat: new Prisma.Decimal(moneyString(product.sourcePriceExVat)),
          markupPercent: new Prisma.Decimal(moneyString(product.markupPercent)),
          priceExVat: new Prisma.Decimal(moneyString(product.priceExVat)),
          vatRate: new Prisma.Decimal(moneyString(product.vatRate)),
          source: product.source,
          sourceUrl: product.sourceUrl,
          specifications: product.specifications as Prisma.InputJsonValue,
          lastScrapedAt: product.lastScrapedAt,
          categoryId,
          manufacturerId
        }
      });

      await tx.productImage.deleteMany({
        where: { productId: upserted.id }
      });

      if (product.imageUrls.length > 0) {
        await tx.productImage.createMany({
          data: product.imageUrls.map((url, index) => ({
            productId: upserted.id,
            sourceUrl: url,
            sortOrder: index
          }))
        });
      }
    });
  }

  return { persistedCount: products.length };
}
