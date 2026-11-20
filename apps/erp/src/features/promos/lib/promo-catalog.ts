import type { Category, Collection, Offer, Product } from "@capella/shared";
import type { PromoTargetInput } from "@capella/shared";
import type { PromoGiftType } from "./promo-form";

export type CatalogOption = { id: number; label: string };
export type PromoCatalog = {
  options: Record<PromoTargetInput["type"], CatalogOption[]>;
  giftOptions: Record<PromoGiftType, CatalogOption[]>;
  targetLabel: (target: PromoTargetInput) => string;
  giftLabel: (type: PromoGiftType, id: number) => string;
};

export const TARGET_TYPE_LABELS: Record<PromoTargetInput["type"], string> = {
  category: "قسم",
  product: "منتج",
  variant: "مقاس منتج",
  offer: "عرض",
  collection: "مجموعة"
};

export const GIFT_TYPE_LABELS: Record<PromoGiftType, string> = { product_variant: "منتج (مقاس)", offer: "عرض", collection: "مجموعة" };

/** Names for every item a promo code can target or give away, from the ERP's loaded catalog. */
export function buildPromoCatalog(input: { products: Product[]; categories: Category[]; offers: Offer[]; collections: Collection[] }): PromoCatalog {
  const live = <T extends { deletedAt?: string | null }>(items: T[]) => items.filter((item) => !item.deletedAt);
  const variants = live(input.products).flatMap((product) => product.variants.map((variant) => ({
    id: variant.id,
    label: `${product.name.ar} — ${variant.size}`
  })));
  const options: PromoCatalog["options"] = {
    category: live(input.categories).map((category) => ({ id: category.id, label: category.name.ar })),
    product: live(input.products).map((product) => ({ id: product.id, label: product.name.ar })),
    variant: variants,
    offer: live(input.offers).map((offer) => ({ id: offer.id, label: offer.name.ar })),
    collection: live(input.collections).map((collection) => ({ id: collection.id, label: collection.name.ar }))
  };
  const lookup = (list: CatalogOption[], id: number) => list.find((option) => option.id === id)?.label ?? `#${id}`;
  return {
    options,
    giftOptions: { product_variant: variants, offer: options.offer, collection: options.collection },
    targetLabel: (target) => `${TARGET_TYPE_LABELS[target.type]}: ${lookup(options[target.type], target.id)}`,
    giftLabel: (type, id) => lookup(type === "product_variant" ? variants : options[type], id)
  };
}
