import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { eq } from "drizzle-orm";
import { collectionItems, collections, productColors, productSizes, productVariants } from "@minikoshk/database/drizzle/schema";
import { db } from "@minikoshk/database/src/db";
import * as productRepository from "../../src/repositories/product.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

beforeEach(resetApiTestDatabase);

test("replaces product options with the complete size by color combination matrix", async () => {
  const replaceOptions = (productRepository as unknown as {
    replaceProductOptionsAndVariantsRepo?: (...args: any[]) => Promise<void>;
  }).replaceProductOptionsAndVariantsRepo;
  assert.equal(typeof replaceOptions, "function");

  const { leafCategoryId } = await getBaselineIds();
  const product = await productRepository.createAdminProductRepo({
    sku: `MATRIX-${Date.now()}`,
    slug: `matrix-${Date.now()}`,
    arName: "مصفوفة",
    enName: "Matrix",
    buyingPrice: 10,
    keywords: "matrix",
    categoryId: leafCategoryId,
    status: "inactive"
  });
  const productOneId = product.id;
  const sizes = [
    { id: -1, label: "100ml" },
    { id: -2, label: "200ml" },
    { id: -3, label: "300ml" }
  ];
  const colors = [
    { id: -11, hex: "#FFFFFF" },
    { id: -12, hex: "#000000" },
    { id: -13, hex: "#FF0000" }
  ];
  const variants = sizes.flatMap((size) => colors.map((color) => ({
    sizeId: size.id,
    colorId: color.id,
    sellingPrice: 25,
    stockQty: 2
  })));

  await replaceOptions!(productOneId, sizes, colors, variants);

  const [savedSizes, savedColors, savedVariants] = await Promise.all([
    db.select().from(productSizes).where(eq(productSizes.productId, productOneId)),
    db.select().from(productColors).where(eq(productColors.productId, productOneId)),
    db.select().from(productVariants).where(eq(productVariants.productId, productOneId))
  ]);
  assert.equal(savedSizes.filter((row) => row.deletedAt == null).length, 3);
  assert.equal(savedColors.filter((row) => row.deletedAt == null).length, 3);
  assert.equal(savedVariants.filter((row) => row.deletedAt == null).length, 9);
  assert.equal(new Set(savedVariants.map((row) => `${row.sizeId}:${row.colorId}`)).size, 9);
});

test("rolls back an incomplete size by color matrix", async () => {
  const { leafCategoryId } = await getBaselineIds();
  const product = await productRepository.createAdminProductRepo({
    sku: `INCOMPLETE-${Date.now()}`,
    slug: `incomplete-${Date.now()}`,
    arName: "ناقص",
    enName: "Incomplete",
    buyingPrice: 10,
    keywords: "matrix",
    categoryId: leafCategoryId,
    status: "inactive"
  });
  const sizes = [{ id: -1, label: "S" }, { id: -2, label: "M" }];
  const colors = [{ id: -3, hex: "#FFFFFF" }, { id: -4, hex: "#000000" }];

  await assert.rejects(
    productRepository.replaceProductOptionsAndVariantsRepo(product.id, sizes, colors, [
      { sizeId: -1, colorId: -3, sellingPrice: 10, stockQty: 1 },
      { sizeId: -1, colorId: -4, sellingPrice: 10, stockQty: 1 },
      { sizeId: -2, colorId: -3, sellingPrice: 10, stockQty: 1 }
    ]),
    /complete/i
  );

  const savedSizes = await db.select().from(productSizes).where(eq(productSizes.productId, product.id));
  assert.equal(savedSizes.length, 0);
});

test("rejects malformed options and variant values before database writes", async () => {
  const { leafCategoryId } = await getBaselineIds();
  const product = await productRepository.createAdminProductRepo({
    sku: `INVALID-OPTIONS-${Date.now()}`,
    slug: `invalid-options-${Date.now()}`,
    arName: "غير صالح",
    enName: "Invalid options",
    buyingPrice: 10,
    keywords: "validation",
    categoryId: leafCategoryId,
    status: "inactive"
  });
  const invalidInputs = [
    {
      sizes: [{ id: -1, label: "   " }], colors: [],
      variants: [{ sizeId: -1, colorId: null, sellingPrice: 10, stockQty: 1 }]
    },
    {
      sizes: [{ id: -1, label: "S" }, { id: -2, label: "s" }], colors: [],
      variants: [
        { sizeId: -1, colorId: null, sellingPrice: 10, stockQty: 1 },
        { sizeId: -2, colorId: null, sellingPrice: 10, stockQty: 1 }
      ]
    },
    {
      sizes: [{ id: -1, label: "S" }], colors: [{ id: -2, hex: "#FFFFFF" }, { id: -3, hex: "#FFFFFF" }],
      variants: [
        { sizeId: -1, colorId: -2, sellingPrice: 10, stockQty: 1 },
        { sizeId: -1, colorId: -3, sellingPrice: 10, stockQty: 1 }
      ]
    },
    {
      sizes: [{ id: -1, label: "S" }], colors: [],
      variants: [{ sizeId: -1, colorId: null, sellingPrice: Number.NaN, stockQty: -1 }]
    }
  ];

  for (const input of invalidInputs) {
    await assert.rejects(
      productRepository.replaceProductOptionsAndVariantsRepo(product.id, input.sizes, input.colors, input.variants),
      (error: any) => error?.code === "INVALID_PRODUCT_OPTIONS"
    );
  }

  const savedSizes = await db.select().from(productSizes).where(eq(productSizes.productId, product.id));
  assert.equal(savedSizes.length, 0);
});

test("preserves size-only variant ids when the first colors are added", async () => {
  const { leafCategoryId } = await getBaselineIds();
  const product = await productRepository.createAdminProductRepo({
    sku: `CONVERT-${Date.now()}`,
    slug: `convert-${Date.now()}`,
    arName: "تحويل",
    enName: "Convert",
    buyingPrice: 10,
    keywords: "matrix",
    categoryId: leafCategoryId,
    status: "inactive"
  });
  await productRepository.replaceProductOptionsAndVariantsRepo(
    product.id,
    [{ id: -1, label: "S" }, { id: -2, label: "M" }],
    [],
    [
      { sizeId: -1, colorId: null, sellingPrice: 10, stockQty: 1 },
      { sizeId: -2, colorId: null, sellingPrice: 12, stockQty: 2 }
    ]
  );
  const initialSizes = await db.select().from(productSizes).where(eq(productSizes.productId, product.id));
  const initialVariants = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));

  await productRepository.replaceProductOptionsAndVariantsRepo(
    product.id,
    initialSizes.map((size) => ({ id: size.id, label: size.sizeLabel })),
    [{ id: -10, hex: "#FFFFFF" }, { id: -11, hex: "#000000" }],
    initialVariants.flatMap((variant) => [
      { id: variant.id, sizeId: variant.sizeId, colorId: -10, sellingPrice: Number(variant.sellingPrice), stockQty: variant.stockQty },
      { sizeId: variant.sizeId, colorId: -11, sellingPrice: Number(variant.sellingPrice), stockQty: 0 }
    ])
  );

  const converted = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
  assert.equal(converted.filter((variant) => variant.deletedAt == null).length, 4);
  assert.deepEqual(
    initialVariants.map((variant) => variant.id).sort((a, b) => a - b),
    converted.filter((variant) => initialVariants.some((initial) => initial.id === variant.id))
      .map((variant) => variant.id).sort((a, b) => a - b)
  );
});

test("returns a bundle conflict before removing a collection-linked combination", async () => {
  const { leafCategoryId } = await getBaselineIds();
  const product = await productRepository.createAdminProductRepo({
    sku: `COLLECTION-LINK-${Date.now()}`,
    slug: `collection-link-${Date.now()}`,
    arName: "مرتبط",
    enName: "Linked",
    buyingPrice: 10,
    keywords: "matrix",
    categoryId: leafCategoryId,
    status: "inactive"
  });
  await productRepository.replaceProductOptionsAndVariantsRepo(
    product.id,
    [{ id: -1, label: "S" }, { id: -2, label: "M" }],
    [],
    [
      { sizeId: -1, colorId: null, sellingPrice: 10, stockQty: 1 },
      { sizeId: -2, colorId: null, sellingPrice: 12, stockQty: 2 }
    ]
  );
  const sizes = await db.select().from(productSizes).where(eq(productSizes.productId, product.id));
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
  const [collection] = await db.insert(collections).values({
    slug: `linked-collection-${Date.now()}`,
    arName: "مجموعة",
    enName: "Collection",
    fixedPrice: "10.00",
    categoryId: leafCategoryId
  }).$returningId();
  await db.insert(collectionItems).values({ collectionId: collection.id, variantId: variants[0]!.id, qty: 1 });

  await assert.rejects(
    productRepository.replaceProductOptionsAndVariantsRepo(
      product.id,
      [{ id: sizes[1]!.id, label: sizes[1]!.sizeLabel }],
      [],
      [{ id: variants[1]!.id, sizeId: sizes[1]!.id, colorId: null, sellingPrice: 12, stockQty: 2 }]
    ),
    (error: any) => error?.code === "PRODUCT_VARIANT_LINKED_TO_BUNDLES"
  );
});
