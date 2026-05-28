import type { MetadataRoute } from "next";
import { languages, type Language } from "@capella/shared";
import { absoluteUrl, localizePath } from "@/lib/seo";
import { loadSitemapData } from "@/lib/storefront-static-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products, categories, offers } = await loadSitemapData();

  const productEntries = products
    .filter((product) => product.status === "active" && !product.deletedAt)
    .flatMap((product) =>
      languages.map((lang) => ({
        url: absoluteUrl(localizePath(lang as Language, `/products/${product.slug}`))
      }))
    );

  const categoryEntries = categories
    .filter((category) => !category.deletedAt)
    .flatMap((category) =>
      languages.map((lang) => ({
        url: absoluteUrl(localizePath(lang as Language, `/category/${category.slug}`))
      }))
    );

  const offerEntries = offers
    .filter((offer) => offer.status === "active" && !offer.deletedAt)
    .flatMap((offer) =>
      languages.map((lang) => ({
        url: absoluteUrl(localizePath(lang as Language, `/offers/${offer.slug}`))
      }))
    );

  const staticEntries = languages.flatMap((lang) => {
    const locale = lang as Language;
    return [
      { url: absoluteUrl(localizePath(locale)) },
      { url: absoluteUrl(localizePath(locale, "/products")) },
      { url: absoluteUrl(localizePath(locale, "/offers")) }
    ];
  });

  return [...staticEntries, ...categoryEntries, ...productEntries, ...offerEntries];
}
