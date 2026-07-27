import type { Metadata, MetadataRoute } from "next";
import { defaultLanguage, getEffectiveVariantPrice, pickLang, type Category, type Collection, type Language, type Offer, type Product } from "@capella/shared";
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
    title: {
      default: `${BRAND_NAME} | Chocolate, bakery & café in Cairo`,
      template: `%s | ${BRAND_NAME}`
    },
    description: "Order chocolate, bon-bons, cakes, coffee, and nuts from Đespacito Delight in Cairo. Arabic and English, cash on delivery.",
    openGraph: {
      type: "website",
      siteName: BRAND_NAME,
      title: `${BRAND_NAME} | Chocolate, bakery & café in Cairo`,
      description: "Order chocolate, bon-bons, cakes, coffee, and nuts from Đespacito Delight in Cairo.",
      url: absoluteUrl("/")
    },
    twitter: {
      card: "summary_large_image",
      title: `${BRAND_NAME} | Chocolate, bakery & café in Cairo`,
      description: "Order chocolate, bon-bons, cakes, coffee, and nuts from Đespacito Delight in Cairo."
    }
  };
}

export function buildLocaleMetadata(lang: Language): Metadata {
  const isAr = lang === "ar";
  const title = isAr ? "ديسباسيتو ديلايت | شوكولاتة ومخبوزات وقهوة" : `${BRAND_NAME} | Chocolate, bakery, café and nuts`;
  const description = isAr
    ? "اطلب الشوكولاتة والبونبون والتورت والقهوة والمكسرات من ديسباسيتو ديلايت في القاهرة. صفحات عربية وإنجليزية."
    : "Đespacito Delight storefront for chocolate, bon-bons, bakery, café and nuts, with indexable Arabic and English pages.";

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
  const title = isAr ? "تسوق الشوكولاتة والمخبوزات والقهوة" : "Shop chocolate, bakery, café and nuts";
  const description = isAr
    ? "تصفح الشوكولاتة والبونبون والمخبوزات والقهوة والمكسرات من ديسباسيتو ديلايت، بالعربية والإنجليزية."
    : "Browse chocolate, bon-bons, bakery, café and nuts from Đespacito Delight.";

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
      ? `تسوق ${label} من ديسباسيتو ديلايت. تصفح ${trail || label} في صفحة قسم واضحة وسهلة الفهرسة.`
      : `Shop ${label} at Đespacito Delight. Browse ${trail || label} on a category page built for clear search discovery.`
  );
  const title = lang === "ar" ? `${label} | ديسباسيتو ديلايت` : `${label} | ${count} products`;

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
  const title = isAr ? "المتجر | العروض وما على الفاترينة" : "Shop | Offers and what's on the counter";
  const description = isAr
    ? "العروض الحالية والوصول الجديد والأكثر مبيعًا من ديسباسيتو ديلايت، ونصائح من وراء الفاترينة."
    : "Current offers, new arrivals, bestsellers, and tips from the counter at Đespacito Delight.";

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
  const title = lang === "ar" ? "عروض ديسباسيتو ديلايت" : "Đespacito Delight offers";
  const description = lang === "ar"
    ? "عروض ديسباسيتو ديلايت للطلبات الأكبر والهدايا."
    : "Đespacito Delight offers for bigger orders and gifting.";

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
  const title = lang === "ar" ? "علب ديسباسيتو ديلايت" : "Đespacito Delight boxes";
  const description = lang === "ar"
    ? "علب ديسباسيتو ديلايت الجاهزة، مجمّعة حسب القسم وبسعر أوفر."
    : "Đespacito Delight boxes, grouped by category and priced better than buying separately.";

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

export function buildContactMetadata(lang: Language): Metadata {
  const isAr = lang === "ar";
  const title = isAr ? "تواصل معنا | مركز مساعدة ديسباسيتو ديلايت" : "Contact Us | Đespacito Delight Help Center";
  const description = isAr
    ? "تواصل مع فريق ديسباسيتو ديلايت بخصوص طلب أو علبة مخصصة أو طلب لمناسبة. نرد خلال يومي عمل."
    : "Reach the Đespacito Delight team about an order, a custom box, or an event order. We reply within 2 business days.";

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

export function productJsonLd(lang: Language, product: Product, category?: Category) {
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
    offers: firstVariant ? {
      "@type": "Offer",
      url: absoluteUrl(localizePath(lang, `/products/${product.slug}`)),
      priceCurrency: "EGP",
      price: getEffectiveVariantPrice(firstVariant),
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
