import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { languages } from "@minikoshk/shared";

/**
 * On-demand revalidation hook called by the API after admin mutations (see
 * `apps/api/src/modules/admin/storefront-revalidation.ts`). Authenticated with
 * the shared `x-revalidate-secret` header.
 */

const DEFAULT_DEV_SECRET = "dev-revalidate-secret";

type RevalidatePayload = {
  entity?: "product" | "offer" | "collection" | "advice" | "homepage-banners";
  slug?: string;
  previousSlug?: string;
  categorySlugs?: string[];
  relatedProductSlugs?: string[];
};

/** Per-entity list pages (locale-relative); detail pages are added from the payload slugs. */
const LIST_PATHS: Record<NonNullable<RevalidatePayload["entity"]>, string[]> = {
  product: ["", "shop", "products", "newarrivals", "bestsellers"],
  offer: ["", "shop", "offers"],
  collection: ["", "shop", "collections"],
  advice: ["", "shop"],
  "homepage-banners": ["", "shop"]
};

const DETAIL_PATHS: Partial<Record<NonNullable<RevalidatePayload["entity"]>, string>> = {
  product: "products",
  offer: "offers",
  collection: "collections"
};

/**
 * Mirrors the API's `resolveSecret` contract: the dev fallback is only usable
 * outside production; a production deployment must set the env var.
 */
function resolveSecret(): string | null {
  const configured = process.env.STOREFRONT_REVALIDATE_SECRET?.trim();
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? null : DEFAULT_DEV_SECRET;
}

function secretMatches(provided: string | null, expected: string): boolean {
  if (provided === null) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

function cleanSlugs(...values: Array<string | string[] | undefined>): string[] {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((slug): slug is string => typeof slug === "string" && slug.trim().length > 0)
    .map((slug) => slug.trim());
}

export async function POST(request: NextRequest) {
  const secret = resolveSecret();
  if (!secret) {
    return NextResponse.json({ message: "Revalidation secret not configured" }, { status: 503 });
  }
  if (!secretMatches(request.headers.get("x-revalidate-secret"), secret)) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload) || !Object.hasOwn(payload, "entity")) {
    return NextResponse.json({ message: "Unknown entity" }, { status: 400 });
  }
  const body = payload as RevalidatePayload;
  const entity = body.entity;
  if (!entity || !Object.hasOwn(LIST_PATHS, entity)) {
    return NextResponse.json({ message: "Unknown entity" }, { status: 400 });
  }

  const relativePaths = new Set(LIST_PATHS[entity]);
  const detailBase = DETAIL_PATHS[entity];
  if (detailBase) {
    for (const slug of cleanSlugs(body.slug, body.previousSlug)) {
      relativePaths.add(`${detailBase}/${slug}`);
    }
  }
  // Product pages embed related-item cards, so a change to this entity must
  // also refresh the products that reference it.
  for (const slug of cleanSlugs(body.relatedProductSlugs)) {
    relativePaths.add(`products/${slug}`);
  }

  const expandedPaths = languages.flatMap((lang) =>
    [...relativePaths].map((relative) => relative ? `/${lang}/${relative}` : `/${lang}`)
  );
  if (expandedPaths.some((path) => path.length > 1024)) {
    return NextResponse.json({ message: "Revalidation path too long" }, { status: 400 });
  }

  const revalidated: string[] = [];
  for (const path of expandedPaths) {
    revalidatePath(path);
    revalidated.push(path);
  }

  return NextResponse.json({ revalidated });
}
