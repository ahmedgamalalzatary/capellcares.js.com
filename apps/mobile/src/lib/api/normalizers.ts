import type {
  Category,
  Collection,
  EntityMedia,
  Offer,
  Product,
  RelatedItemCard,
  ReviewPrompt,
  ShopMediaSection,
  WishlistEntry
} from "@capella/shared";
import { API_BASE } from "./base";
import type {
  CategoryApiShape,
  CollectionApiShape,
  OfferApiShape,
  ProductApiShape
} from "./types";

export function resolveMediaUrl(url: string | null | undefined): string {
  const value = url?.trim() ?? "";
  if (!value) {
    return "";
  }
  const loopbackUpload = value.match(
    /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/uploads\/.*)$/i
  );
  if (loopbackUpload) {
    return `${API_BASE}${loopbackUpload[1]}`;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (value.startsWith("/uploads/")) {
    return `${API_BASE}${value}`;
  }
  return value;
}

function resolveNullableMediaUrl(url: string | null | undefined): string | null {
  return resolveMediaUrl(url) || null;
}

function resolveNativeEntityHref(href: string | null): string | null {
  if (!href) {
    return null;
  }
  return href
    .replace(/^\/products\//, "/product/")
    .replace(/^\/offers\//, "/offer/")
    .replace(/^\/collections\//, "/collection/");
}

function normalizeMedia(media: EntityMedia[] | undefined): EntityMedia[] {
  return (media ?? []).map((item) =>
    item.type === "video"
      ? { ...item, url: resolveMediaUrl(item.url) }
      : {
          ...item,
          arUrl: resolveNullableMediaUrl(item.arUrl),
          enUrl: resolveNullableMediaUrl(item.enUrl)
        }
  );
}

function normalizeRelatedItems(
  items: RelatedItemCard[] | undefined
): RelatedItemCard[] | undefined {
  return items?.map((item) => ({
    ...item,
    imagePath: resolveNullableMediaUrl(item.imagePath)
  }));
}

function requiredPositiveId(value: unknown, field: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Invalid ${field}`);
  }
  return numeric;
}

export function normalizeCategory(input: CategoryApiShape): Category {
  const sortOrder = Number(input.sortOrder);
  return {
    id: requiredPositiveId(input.id, "category id"),
    parentId:
      input.parentId == null
        ? null
        : requiredPositiveId(input.parentId, "category parentId"),
    slug: input.slug,
    imagePath: resolveNullableMediaUrl(input.imagePath),
    sortOrder:
      input.sortOrder != null && input.sortOrder !== "" && Number.isFinite(sortOrder)
        ? sortOrder
        : undefined,
    name: {
      ar: input.name?.ar ?? input.arName ?? "",
      en: input.name?.en ?? input.enName ?? ""
    },
    isLeaf: Boolean(input.isLeaf ?? true),
    createdAt: input.createdAt ?? "",
    deletedAt: input.deletedAt ?? null
  };
}

export function normalizeProduct<T extends ProductApiShape>(product: T): T & Product {
  const normalizedImagePath = resolveMediaUrl(product.imagePath);
  const media = product.media?.length
    ? normalizeMedia(product.media)
    : normalizedImagePath
      ? [{ type: "image" as const, arUrl: null, enUrl: normalizedImagePath }]
      : [];
  const fallbackImage = media.find((item) => item.type === "image");

  return {
    ...product,
    id: requiredPositiveId(product.id, "product id"),
    categoryId: requiredPositiveId(product.categoryId, "product categoryId"),
    imagePath:
      normalizedImagePath ||
      (fallbackImage?.type === "image"
        ? fallbackImage.enUrl ?? fallbackImage.arUrl ?? ""
        : ""),
    hoverImagePath: resolveMediaUrl(product.hoverImagePath),
    media,
    relatedItems: normalizeRelatedItems(product.relatedItems as RelatedItemCard[] | undefined),
    variants: product.variants.map((variant) => ({
      ...variant,
      id: requiredPositiveId(variant.id, "variant id"),
      productId: requiredPositiveId(variant.productId, "variant productId"),
      discount: variant.discount
        ? {
            ...variant.discount,
            id:
              variant.discount.id == null
                ? undefined
                : requiredPositiveId(variant.discount.id, "discount id"),
            variantId:
              variant.discount.variantId == null
                ? undefined
                : requiredPositiveId(variant.discount.variantId, "discount variantId"),
            value: Number(variant.discount.value)
          }
        : null
    }))
  } as T & Product;
}

function normalizeBundle<T extends OfferApiShape | CollectionApiShape>(bundle: T): T {
  return {
    ...bundle,
    id: requiredPositiveId(bundle.id, "bundle id"),
    categoryId:
      bundle.categoryId == null
        ? null
        : requiredPositiveId(bundle.categoryId, "bundle categoryId"),
    imagePath: resolveMediaUrl(bundle.imagePath),
    media: normalizeMedia(bundle.media),
    items: bundle.items.map((item) => ({
      ...item,
      id:
        item.id == null
          ? undefined
          : requiredPositiveId(item.id, "bundle item id"),
      variantId: requiredPositiveId(item.variantId, "bundle item variantId")
    })),
    relatedItems: normalizeRelatedItems(
      bundle.relatedItems as RelatedItemCard[] | undefined
    )
  };
}

export function normalizeOffer<T extends OfferApiShape>(offer: T): T & Offer {
  return normalizeBundle(offer) as T & Offer;
}

export function normalizeCollection<T extends CollectionApiShape>(
  collection: T
): T & Collection {
  return normalizeBundle(collection) as T & Collection;
}

export function normalizeShopMediaSection(
  section: ShopMediaSection
): ShopMediaSection {
  return {
    ...section,
    items: section.items.map((item) => ({
      ...item,
      arImagePath: resolveNullableMediaUrl(item.arImagePath),
      arMobileImagePath: resolveNullableMediaUrl(item.arMobileImagePath),
      enImagePath: resolveNullableMediaUrl(item.enImagePath),
      enMobileImagePath: resolveNullableMediaUrl(item.enMobileImagePath)
    }))
  };
}

export function normalizeWishlistEntry(entry: WishlistEntry): WishlistEntry {
  return {
    ...entry,
    entityId: requiredPositiveId(entry.entityId, "wishlist entityId"),
    imagePath: resolveNullableMediaUrl(entry.imagePath),
    href: resolveNativeEntityHref(entry.href)
  };
}

export function normalizeReviewPrompt(prompt: ReviewPrompt): ReviewPrompt {
  return {
    ...prompt,
    imagePath: resolveNullableMediaUrl(prompt.imagePath),
    href: resolveNativeEntityHref(prompt.href) ?? prompt.href
  };
}
