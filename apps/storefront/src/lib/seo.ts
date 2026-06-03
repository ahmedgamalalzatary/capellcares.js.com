import type { Metadata, MetadataRoute } from "next";
import { defaultLanguage, pickLang, type Category, type Collection, type Language, type Offer, type Product } from "@capella/shared";

const FALLBACK_SITE_URL = "https://capellacares.com";
const BRAND_NAME = "Capella Care";

const PUBLIC_REVALIDATE_SECONDS = 300;

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || FALLBACK_SITE_URL;
}

function getMetadataBase(): URL {
  return new URL(getSiteUrl());
}

export function localizePath(lang: Language, path = ""): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/${lang}${normalized === "/" ? "" : normalized}`;
}

export function absoluteUrl(path: string): string {
  return new URL(path, getSiteUrl()).toString();
}

function buildLocalizedAlternates(_lang: Language, path: string) {
  return {
    canonical: localizePath(defaultLanguage, path),
    languages: {
      ar: localizePath("ar", path),
      en: localizePath("en", path),
      "x-default": localizePath(defaultLanguage, path)
    }
  } as Metadata["alternates"];
}

function trimText(text: string, max = 160): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function joinTitle(parts: string[]): string {
  return parts.filter(Boolean).join(" | ");
}

export function buildRootMetadata(): Metadata {
  return {
    metadataBase: getMetadataBase(),
    applicationName: BRAND_NAME,
    title: {
      default: `${BRAND_NAME} | Egyptian beauty and self-care`,
      template: `%s | ${BRAND_NAME}`
    },
    description: "Bilingual Egyptian beauty storefront for skincare, body care, hair care, makeup, fragrances, and curated bundles.",
    openGraph: {
      type: "website",
      siteName: BRAND_NAME,
      title: `${BRAND_NAME} | Egyptian beauty and self-care`,
      description: "Shop bilingual beauty and self-care essentials across skincare, body care, hair care, makeup, and offers.",
      url: absoluteUrl("/")
    },
    twitter: {
      card: "summary_large_image",
      title: `${BRAND_NAME} | Egyptian beauty and self-care`,
      description: "Shop bilingual beauty and self-care essentials across skincare, body care, hair care, makeup, and offers."
    }
  };
}

export function buildLocaleMetadata(lang: Language): Metadata {
  const isAr = lang === "ar";
  const title = isAr ? "كابيلا كير | منتجات العناية والجمال" : `${BRAND_NAME} | Beauty and self-care products`;
  const description = isAr
    ? "متجر كابيلا كير للعناية بالبشرة والجسم والشعر والمكياج والعطور، مع صفحات عربية وإنجليزية قابلة للفهرسة."
    : "Capella Care storefront for skincare, body care, hair care, makeup, fragrances, and bundles with indexable Arabic and English pages.";

  return {
    title,
    description,
    alternates: buildLocalizedAlternates(lang, ""),
    openGraph: {
      locale: isAr ? "ar_EG" : "en_US",
      type: "website",
      title,
      description,
      url: absoluteUrl(localizePath(lang))
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export function buildProductsMetadata(lang: Language): Metadata {
  const isAr = lang === "ar";
  const title = isAr ? "تسوقي منتجات العناية والجمال" : "Shop beauty and self-care products";
  const description = isAr
    ? "اكتشفي منتجات العناية بالبشرة والجسم والشعر والمكياج من كابيلا كير مع تصفح عربي وإنجليزي منظم."
    : "Browse skincare, body care, hair care, makeup, and everyday self-care products from Capella Care.";

  return {
    title,
    description,
    alternates: buildLocalizedAlternates(lang, "/products"),
    openGraph: {
      title: joinTitle([title, BRAND_NAME]),
      description,
      url: absoluteUrl(localizePath(lang, "/products"))
    },
    twitter: {
      card: "summary_large_image",
      title: joinTitle([title, BRAND_NAME]),
      description
    }
  };
}

export function buildCategoryMetadata(lang: Language, category: Category, path: Category[], count: number): Metadata {
  const label = pickLang(category.name, lang);
  const trail = path.map((item) => pickLang(item.name, lang)).join(" / ");
  const description = trimText(
    lang === "ar"
      ? `تسوقي ${label} من كابيلا كير. تصفحي منتجات ${trail || label} مع صفحات فئات واضحة وسهلة الفهرسة.`
      : `Shop ${label} at Capella Care. Browse ${trail || label} products on a category page built for clear search discovery.`
  );
  const title = lang === "ar" ? `${label} | منتجات كابيلا كير` : `${label} | ${count} products`;

  return {
    title,
    description,
    alternates: buildLocalizedAlternates(lang, `/category/${category.slug}`),
    openGraph: {
      title: joinTitle([title, BRAND_NAME]),
      description,
      url: absoluteUrl(localizePath(lang, `/category/${category.slug}`))
    },
    twitter: {
      card: "summary_large_image",
      title: joinTitle([label, BRAND_NAME]),
      description
    }
  };
}

export function buildProductMetadata(lang: Language, product: Product, category?: Category, path: Category[] = []): Metadata {
  const productName = pickLang(product.name, lang);
  const categoryLabel = category ? pickLang(category.name, lang) : "";
  const trail = path.map((item) => pickLang(item.name, lang)).join(" / ");
  const description = trimText(
    [pickLang(product.description, lang), trail && (lang === "ar" ? `الفئة: ${trail}` : `Category: ${trail}`)]
      .filter(Boolean)
      .join(" ")
  );
  const title = joinTitle([productName, categoryLabel, BRAND_NAME]);

  return {
    title,
    description,
    keywords: product.keywords,
    alternates: buildLocalizedAlternates(lang, `/products/${product.slug}`),
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(localizePath(lang, `/products/${product.slug}`))
    } as Metadata["openGraph"],
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export function buildShopMetadata(lang: Language): Metadata {
  const isAr = lang === "ar";
  const title = isAr ? "متجر كابيلا | العروض والمنتجات المميزة" : "Capella Shop | Offers & featured products";
  const description = isAr
    ? "اكتشفي أحدث العروض والمنتجات الجديدة والأكثر مبيعًا من كابيلا كير، مع نصائح عناية مختارة."
    : "Discover active offers, new arrivals, bestsellers, and curated care advice from Capella Care.";

  return {
    title,
    description,
    alternates: buildLocalizedAlternates(lang, "/shop"),
    openGraph: {
      title: joinTitle([title, BRAND_NAME]),
      description,
      url: absoluteUrl(localizePath(lang, "/shop"))
    },
    twitter: {
      card: "summary_large_image",
      title: joinTitle([title, BRAND_NAME]),
      description
    }
  };
}

export function buildOffersMetadata(lang: Language): Metadata {
  const title = lang === "ar" ? "عروض وباقات كابيلا كير" : "Capella Care offers and bundles";
  const description = lang === "ar"
    ? "اكتشفي باقات كابيلا كير المختارة بعناية لتسوق أوفر وروتين متكامل."
    : "Discover curated Capella Care bundles for better-value routines and gifting.";

  return {
    title,
    description,
    alternates: buildLocalizedAlternates(lang, "/offers"),
    openGraph: {
      title: joinTitle([title, BRAND_NAME]),
      description,
      url: absoluteUrl(localizePath(lang, "/offers"))
    },
    twitter: {
      card: "summary_large_image",
      title: joinTitle([title, BRAND_NAME]),
      description
    }
  };
}

export function buildCollectionsMetadata(lang: Language): Metadata {
  const title = lang === "ar" ? "مجموعات كابيلا كير" : "Capella Care collections";
  const description = lang === "ar"
    ? "اكتشفي مجموعات كابيلا كير المجمعة حسب القسم لروتين متكامل وسعر أوفر."
    : "Discover Capella Care collections grouped by category for complete routines at a better price.";

  return {
    title,
    description,
    alternates: buildLocalizedAlternates(lang, "/collections"),
    openGraph: {
      title: joinTitle([title, BRAND_NAME]),
      description,
      url: absoluteUrl(localizePath(lang, "/collections"))
    },
    twitter: {
      card: "summary_large_image",
      title: joinTitle([title, BRAND_NAME]),
      description
    }
  };
}

export function buildOfferMetadata(lang: Language, offer: Offer): Metadata {
  const name = pickLang(offer.name, lang);
  const description = trimText(pickLang(offer.description, lang));
  const title = joinTitle([name, BRAND_NAME]);

  return {
    title,
    description,
    alternates: buildLocalizedAlternates(lang, `/offers/${offer.slug}`),
    openGraph: {
      title,
      description,
      url: absoluteUrl(localizePath(lang, `/offers/${offer.slug}`))
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export function buildCollectionMetadata(lang: Language, collection: Collection): Metadata {
  const name = pickLang(collection.name, lang);
  const description = trimText(pickLang(collection.description, lang));
  const title = joinTitle([name, BRAND_NAME]);

  return {
    title,
    description,
    alternates: buildLocalizedAlternates(lang, `/collections/${collection.slug}`),
    openGraph: {
      title,
      description,
      url: absoluteUrl(localizePath(lang, `/collections/${collection.slug}`))
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export function noIndexMetadata(): Metadata {
  return {
    robots: {
      index: false,
      follow: true
    }
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url?: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: absoluteUrl(item.url) } : {})
    }))
  };
}

export function productJsonLd(lang: Language, product: Product, category?: Category) {
  const productName = pickLang(product.name, lang);
  const firstVariant = [...product.variants].sort((a, b) => a.price - b.price)[0];
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productName,
    description: pickLang(product.description, lang),
    category: category ? pickLang(category.name, lang) : undefined,
    sku: product.sku,
    image: [absoluteUrl(product.imagePath)],
    offers: firstVariant ? {
      "@type": "Offer",
      url: absoluteUrl(localizePath(lang, `/products/${product.slug}`)),
      priceCurrency: "EGP",
      price: firstVariant.price,
      availability: firstVariant.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    } : undefined
  };
}

export function offerJsonLd(lang: Language, offer: Offer) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: pickLang(offer.name, lang),
    description: pickLang(offer.description, lang),
    image: [absoluteUrl(offer.imagePath)],
    offers: {
      "@type": "Offer",
      url: absoluteUrl(localizePath(lang, `/offers/${offer.slug}`)),
      priceCurrency: "EGP",
      price: offer.price,
      availability: offer.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    }
  };
}

export function collectionJsonLd(lang: Language, collection: Collection) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: pickLang(collection.name, lang),
    description: pickLang(collection.description, lang),
    image: [absoluteUrl(collection.imagePath)],
    offers: {
      "@type": "Offer",
      url: absoluteUrl(localizePath(lang, `/collections/${collection.slug}`)),
      priceCurrency: "EGP",
      price: collection.price,
      availability: collection.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    }
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND_NAME,
    url: getSiteUrl(),
    inLanguage: ["ar-EG", "en-EG"]
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: getSiteUrl()
  };
}

export function buildRobots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/ar/cart",
          "/en/cart",
          "/ar/checkout",
          "/en/checkout",
          "/ar/login",
          "/en/login",
          "/ar/signup",
          "/en/signup",
          "/ar/wishlist",
          "/en/wishlist",
          "/ar/orders",
          "/en/orders"
        ]
      }
    ],
    sitemap: absoluteUrl("/sitemap.xml")
  };
}
