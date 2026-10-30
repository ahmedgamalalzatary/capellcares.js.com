import type { Metadata, MetadataRoute } from "next";
import { defaultLanguage, getEffectiveVariantPrice, pickLang, type Category, type Collection, type Language, type Offer, type Product, type ProductAttribute, type ReviewPage } from "@capella/shared";
import { BRAND_NAME, FALLBACK_SITE_URL } from "@/constants/brand";

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
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "48x48" },
        { url: "/icon.png", type: "image/png", sizes: "192x192" }
      ],
      apple: { url: "/apple-icon.png", sizes: "180x180" }
    },
    title: {
      default: `${BRAND_NAME} | Toys for kids in Egypt`,
      template: `%s | ${BRAND_NAME}`
    },
    description: "Falta Toy is an Egyptian toy shop with toys for every age, from the brands and characters kids love. Free delivery, pay cash on delivery.",
    openGraph: {
      type: "website",
      siteName: BRAND_NAME,
      title: `${BRAND_NAME} | Toys for kids in Egypt`,
      description: "Shop toys for every age from the brands and characters kids love. Free delivery, pay cash on delivery.",
      url: absoluteUrl("/")
    },
    twitter: {
      card: "summary_large_image",
      title: `${BRAND_NAME} | Toys for kids in Egypt`,
      description: "Shop toys for every age from the brands and characters kids love. Free delivery, pay cash on delivery."
    }
  };
}

export function buildLocaleMetadata(lang: Language): Metadata {
  const isAr = lang === "ar";
  const title = isAr ? "فلتة توي | ألعاب أطفال" : `${BRAND_NAME} | Toys for kids`;
  const description = isAr
    ? "فلتة توي متجر ألعاب أطفال لكل الأعمار، من الماركات والشخصيات التي يحبها الأطفال. توصيل مجاني والدفع عند الاستلام."
    : "Falta Toy is a toy shop for every age, with the brands and characters kids love. Free delivery, pay cash on delivery.";

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
  const title = isAr ? "تسوق ألعاب الأطفال" : "Shop toys for kids";
  const description = isAr
    ? "اكتشف ألعاب الأطفال من فلتة توي واختر حسب السن والماركة والشخصية."
    : "Browse toys from Falta Toy and choose by age, brand, and character.";

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
      ? `تسوق ${label} من فلتة توي. تصفح ألعاب ${trail || label}.`
      : `Shop ${label} at Falta Toy. Browse ${trail || label} toys.`
  );
  const title = lang === "ar" ? `${label} | ألعاب فلتة توي` : `${label} | ${count} products`;

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
  // Home page: absolute so the layout template doesn't append the brand a second time.
  const title = isAr
    ? "فلتة توي | متجر ألعاب أطفال"
    : `${BRAND_NAME} | Toy shop for kids`;
  const description = isAr
    ? "تسوق الألعاب حسب الفئة والماركة والشخصية من فلتة توي، مع نصائح لاختيار اللعبة المناسبة."
    : "Shop toys by category, brand, and character at Falta Toy, with advice on choosing the right one.";

  return {
    title: { absolute: title },
    description,
    alternates: buildLocalizedAlternates(lang, "/shop"),
    openGraph: {
      title,
      description,
      url: absoluteUrl(localizePath(lang, "/shop"))
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export function buildOffersMetadata(lang: Language): Metadata {
  const title = lang === "ar" ? "عروض وباقات فلتة توي" : "Falta Toy offers and bundles";
  const description = lang === "ar"
    ? "اكتشف باقات ألعاب فلتة توي بسعر أوفر."
    : "Discover Falta Toy bundles at a better price, great for gifts.";

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
  const title = lang === "ar" ? "مجموعات فلتة توي" : "Falta Toy sets";
  const description = lang === "ar"
    ? "اكتشف مجموعات ألعاب فلتة توي بسعر أوفر."
    : "Discover Falta Toy sets grouped by category, at a better price.";

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

export function buildAttributeMetadata(lang: Language, item: ProductAttribute, section: "brands" | "characters"): Metadata {
  const name = pickLang(item.name, lang);
  const description = lang === "ar" ? `تسوق ألعاب ${name} من ${BRAND_NAME}.` : `Shop ${name} toys at ${BRAND_NAME}.`;
  const path = `/${section}/${item.slug}`;

  return {
    title: name,
    description,
    alternates: buildLocalizedAlternates(lang, path),
    openGraph: {
      title: joinTitle([name, BRAND_NAME]),
      description,
      url: absoluteUrl(localizePath(lang, path))
    },
    twitter: {
      card: "summary_large_image",
      title: joinTitle([name, BRAND_NAME]),
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

export function buildContactMetadata(lang: Language): Metadata {
  const isAr = lang === "ar";
  const title = isAr ? "تواصل معنا | مركز مساعدة فلتة توي" : "Contact Us | Falta Toy Help Center";
  const description = isAr
    ? "تواصل مع فريق فلتة توي للاستفسار عن الطلبات والألعاب أو لإرسال ملاحظاتك. نرد خلال يومي عمل."
    : "Reach the Falta Toy team for help with orders, toy questions, and feedback. We reply within 2 business days.";

  return {
    title,
    description,
    alternates: buildLocalizedAlternates(lang, "/contact"),
    openGraph: {
      title: joinTitle([title, BRAND_NAME]),
      description,
      url: absoluteUrl(localizePath(lang, "/contact"))
    },
    twitter: {
      card: "summary_large_image",
      title: joinTitle([title, BRAND_NAME]),
      description
    }
  };
}

export function buildStaticPageMetadata(
  lang: Language,
  opts: { path: string; titleEn: string; titleAr: string; descEn: string; descAr: string }
): Metadata {
  const isAr = lang === "ar";
  const title = isAr ? opts.titleAr : opts.titleEn;
  const description = trimText(isAr ? opts.descAr : opts.descEn);

  return {
    title,
    description,
    alternates: buildLocalizedAlternates(lang, opts.path),
    openGraph: {
      title: joinTitle([title, BRAND_NAME]),
      description,
      url: absoluteUrl(localizePath(lang, opts.path))
    },
    twitter: {
      card: "summary_large_image",
      title: joinTitle([title, BRAND_NAME]),
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

function aggregateRating(reviewData?: ReviewPage | null) {
  return reviewData && reviewData.summary.reviewCount > 0 ? {
    "@type": "AggregateRating",
    ratingValue: reviewData.summary.averageRating,
    reviewCount: reviewData.summary.reviewCount
  } : undefined;
}

export function productJsonLd(lang: Language, product: Product & { reviewData?: ReviewPage | null }, category?: Category) {
  const productName = pickLang(product.name, lang);
  const firstVariant = [...product.variants].sort(
    (a, b) => getEffectiveVariantPrice(a) - getEffectiveVariantPrice(b)
  )[0];
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productName,
    description: pickLang(product.description, lang),
    category: category ? pickLang(category.name, lang) : undefined,
    sku: product.sku,
    image: [absoluteUrl(product.imagePath)],
    aggregateRating: aggregateRating(product.reviewData),
    offers: firstVariant ? {
      "@type": "Offer",
      url: absoluteUrl(localizePath(lang, `/products/${product.slug}`)),
      priceCurrency: "EGP",
      price: getEffectiveVariantPrice(firstVariant),
      availability: firstVariant.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    } : undefined
  };
}

export function offerJsonLd(lang: Language, offer: Offer & { reviewData?: ReviewPage | null }) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: pickLang(offer.name, lang),
    description: pickLang(offer.description, lang),
    image: [absoluteUrl(offer.imagePath)],
    aggregateRating: aggregateRating(offer.reviewData),
    offers: {
      "@type": "Offer",
      url: absoluteUrl(localizePath(lang, `/offers/${offer.slug}`)),
      priceCurrency: "EGP",
      price: offer.price,
      availability: offer.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    }
  };
}

export function collectionJsonLd(lang: Language, collection: Collection & { reviewData?: ReviewPage | null }) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: pickLang(collection.name, lang),
    description: pickLang(collection.description, lang),
    image: [absoluteUrl(collection.imagePath)],
    aggregateRating: aggregateRating(collection.reviewData),
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
