import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { resolveRevalidateSecret } from "./revalidate-secret";

const REVALIDATE_SECRET = resolveRevalidateSecret();
const LOCALES = ["ar", "en"] as const;

type RevalidateEntity = "product" | "offer" | "collection" | "advice";

type RevalidatePayload = {
  entity?: RevalidateEntity;
  slug?: string;
  previousSlug?: string;
  categorySlugs?: string[];
  relatedProductSlugs?: string[];
};

function trimOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const normalized = value
    .map((item) => trimOptionalString(item))
    .filter((item): item is string => Boolean(item));
  return [...new Set(normalized)];
}

function isValidEntity(value: unknown): value is RevalidateEntity {
  return value === "product" || value === "offer" || value === "collection" || value === "advice";
}

function revalidateLocalizedPath(pathname: string, type?: "page" | "layout") {
  for (const lang of LOCALES) {
    const path = `/${lang}${pathname}`;
    if (type) {
      revalidatePath(path, type);
      continue;
    }
    revalidatePath(path);
  }
}

function revalidateLocalizedDynamicPath(pathname: string, type: "page" | "layout") {
  revalidatePath(`/[lang]${pathname}`, type);
}

function revalidateByEntity(payload: Required<Pick<RevalidatePayload, "entity">> & Omit<RevalidatePayload, "entity">) {
  const slug = trimOptionalString(payload.slug);
  const previousSlug = trimOptionalString(payload.previousSlug);
  const categorySlugs = normalizeSlugs(payload.categorySlugs);
  const relatedProductSlugs = normalizeSlugs(payload.relatedProductSlugs);

  switch (payload.entity) {
    case "product": {
      revalidateLocalizedPath("/shop");
      revalidateLocalizedPath("/products");
      revalidateLocalizedDynamicPath("/products/[slug]", "page");
      revalidateLocalizedDynamicPath("/category/[slug]", "page");
      revalidateLocalizedDynamicPath("/offers/[slug]", "page");
      revalidateLocalizedDynamicPath("/collections/[slug]", "page");
      if (slug) {
        revalidateLocalizedPath(`/products/${slug}`);
      }
      if (previousSlug && previousSlug !== slug) {
        revalidateLocalizedPath(`/products/${previousSlug}`);
      }
      for (const categorySlug of categorySlugs) {
        revalidateLocalizedPath(`/category/${categorySlug}`);
      }
      break;
    }
    case "offer": {
      revalidateLocalizedPath("/shop");
      revalidateLocalizedPath("/offers");
      revalidateLocalizedDynamicPath("/offers/[slug]", "page");
      revalidateLocalizedDynamicPath("/products/[slug]", "page");
      if (slug) {
        revalidateLocalizedPath(`/offers/${slug}`);
      }
      for (const productSlug of relatedProductSlugs) {
        revalidateLocalizedPath(`/products/${productSlug}`);
      }
      break;
    }
    case "collection": {
      revalidateLocalizedPath("/shop");
      revalidateLocalizedPath("/collections");
      revalidateLocalizedDynamicPath("/collections/[slug]", "page");
      revalidateLocalizedDynamicPath("/products/[slug]", "page");
      revalidateLocalizedDynamicPath("/offers/[slug]", "page");
      if (slug) {
        revalidateLocalizedPath(`/collections/${slug}`);
      }
      for (const productSlug of relatedProductSlugs) {
        revalidateLocalizedPath(`/products/${productSlug}`);
      }
      break;
    }
    case "advice": {
      revalidateLocalizedPath("/shop");
      revalidateLocalizedPath("/products");
      break;
    }
  }

  revalidatePath("/sitemap.xml");
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-revalidate-secret")?.trim();
  if (!secret || secret !== REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as RevalidatePayload;
  if (!isValidEntity(payload.entity)) {
    return NextResponse.json({ ok: false, reason: "invalid-payload" }, { status: 400 });
  }

  if (payload.entity !== "advice" && !trimOptionalString(payload.slug)) {
    return NextResponse.json({ ok: false, reason: "invalid-payload" }, { status: 400 });
  }

  revalidateByEntity(payload as Required<Pick<RevalidatePayload, "entity">> & Omit<RevalidatePayload, "entity">);

  return NextResponse.json({ ok: true });
}
