import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  }
}));

vi.mock("@/lib/api/client", () => ({
  fetchCategories: vi.fn(),
  fetchOffers: vi.fn(),
  fetchOfferBySlug: vi.fn(),
  fetchProductBySlug: vi.fn(),
  fetchProducts: vi.fn(),
  getCategoryById: vi.fn(),
  getCategoryBySlug: vi.fn(),
  getCategoryPath: vi.fn(),
  getOffersForProduct: vi.fn(),
  getProductsByCategory: vi.fn()
}));

import * as productsPageModule from "@/app/[lang]/products/page";
import * as productPageModule from "@/app/[lang]/products/[slug]/page";
import * as categoryPageModule from "@/app/[lang]/category/[slug]/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { pickLang } from "@capella/shared";
import { products, categories, offers } from "@capella/shared/mock";
import { buildLocalizedAlternates, buildProductMetadata } from "@/lib/seo";
import {
  fetchCategories,
  fetchOffers,
  fetchOfferBySlug,
  fetchProductBySlug,
  fetchProducts,
  getCategoryById,
  getCategoryBySlug,
  getCategoryPath,
  getOffersForProduct,
  getProductsByCategory
} from "@/lib/api/client";

const mockedFetchCategories = vi.mocked(fetchCategories);
const mockedFetchOffers = vi.mocked(fetchOffers);
const mockedFetchOfferBySlug = vi.mocked(fetchOfferBySlug);
const mockedFetchProductBySlug = vi.mocked(fetchProductBySlug);
const mockedFetchProducts = vi.mocked(fetchProducts);
const mockedGetCategoryById = vi.mocked(getCategoryById);
const mockedGetCategoryBySlug = vi.mocked(getCategoryBySlug);
const mockedGetCategoryPath = vi.mocked(getCategoryPath);
const mockedGetOffersForProduct = vi.mocked(getOffersForProduct);
const mockedGetProductsByCategory = vi.mocked(getProductsByCategory);

describe("storefront SEO", () => {
  it("builds localized alternates with the default-language canonical URL", () => {
    expect(buildLocalizedAlternates("ar", "/products")?.canonical).toBe("/en/products");
  });

  it("builds product metadata with OpenGraph product type", () => {
    const product = products[0]!;
    expect((buildProductMetadata("en", product).openGraph as { type?: string } | undefined)?.type).toBe("product");
  });

  it("generates product metadata with canonical and language alternates", async () => {
    const product = products[0]!;
    const category = categories.find((item) => item.id === product.categoryId)!;

    mockedFetchProductBySlug.mockResolvedValue(product);
    mockedFetchCategories.mockResolvedValue(categories);
    mockedGetCategoryById.mockReturnValue(category);
    mockedGetCategoryPath.mockReturnValue([category]);
    mockedFetchOffers.mockResolvedValue(offers);
    mockedFetchProducts.mockResolvedValue(products);
    mockedGetOffersForProduct.mockReturnValue([]);

    const metadata = await productPageModule.generateMetadata({
      params: Promise.resolve({ lang: "en", slug: product.slug })
    });

    expect(metadata.title).toContain(pickLang(product.name, "en"));
    expect(metadata.description).toContain(pickLang(product.description, "en"));
    expect(metadata.alternates?.canonical).toBe(`/en/products/${product.slug}`);
    expect(metadata.alternates?.languages).toMatchObject({
      ar: `/ar/products/${product.slug}`,
      en: `/en/products/${product.slug}`
    });
  });

  it("generates category metadata for category listings", async () => {
    const category = categories[0]!;
    mockedFetchCategories.mockResolvedValue(categories);
    mockedFetchProducts.mockResolvedValue(products);
    mockedGetCategoryBySlug.mockReturnValue(category);
    mockedGetCategoryPath.mockReturnValue([category]);
    mockedGetProductsByCategory.mockReturnValue(products.filter((item) => item.categoryId === category.id));

    const metadata = await categoryPageModule.generateMetadata({
      params: Promise.resolve({ lang: "en", slug: category.slug })
    });

    expect(metadata.title).toContain(pickLang(category.name, "en"));
    expect(metadata.alternates?.canonical).toBe(`/en/category/${category.slug}`);
    expect(metadata.description).toContain(pickLang(category.name, "en"));
  });

  it("generates products listing metadata with query intent", async () => {
    const metadata = await productsPageModule.generateMetadata({
      params: Promise.resolve({ lang: "en" }),
      searchParams: Promise.resolve({})
    });

    expect(metadata.title).toContain("Shop");
    expect(metadata.description?.toLowerCase()).toContain("browse");
    expect(metadata.alternates?.canonical).toBe("/en/products");
  });

  it("marks private commerce flows as noindex in robots", async () => {
    const metadata = await robots();
    expect(metadata.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ disallow: expect.arrayContaining(["/ar/cart", "/en/cart", "/ar/checkout", "/en/checkout"]) })
      ])
    );
  });

  it("includes public product, category, and offer pages in the sitemap", async () => {
    mockedFetchProducts.mockResolvedValue(products);
    mockedFetchCategories.mockResolvedValue(categories);
    mockedFetchOffers.mockResolvedValue(offers);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls.some((url) => url.includes(`/en/products/${products[0]!.slug}`))).toBe(true);
    expect(urls.some((url) => url.includes(`/ar/category/${categories[0]!.slug}`))).toBe(true);
    expect(urls.some((url) => url.includes(`/en/offers/${offers[0]!.slug}`))).toBe(true);
    expect(urls.some((url) => url.includes("/checkout"))).toBe(false);
    expect(urls.some((url) => url.includes("/wishlist"))).toBe(false);
  });

  it("generates offer metadata for public offer pages", async () => {
    const offer = offers[0]!;
    mockedFetchOfferBySlug.mockResolvedValue(offer);
    mockedFetchProducts.mockResolvedValue(products);

    const module = await import("@/app/[lang]/offers/[slug]/page");
    const metadata = await module.generateMetadata({
      params: Promise.resolve({ lang: "en", slug: offer.slug })
    });

    expect(metadata.title).toContain(pickLang(offer.name, "en"));
    expect(metadata.alternates?.canonical).toBe(`/en/offers/${offer.slug}`);
  });
});
