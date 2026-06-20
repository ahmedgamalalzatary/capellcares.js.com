type OfferLike = {
  id?: number;
  status: "active" | "inactive";
  fixedPrice: unknown;
  items: Array<{ variantId: number; qty: number }>;
};

function toFiniteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function isSingleVariantActiveOffer(offer: OfferLike) {
  return offer.status === "active" && offer.items.length === 1 && offer.items[0]?.qty === 1;
}

export function findSingleVariantActiveOfferPriceByVariantId(offers: OfferLike[]) {
  const result = new Map<number, number>();

  for (const offer of offers) {
    if (!isSingleVariantActiveOffer(offer)) {
      continue;
    }

    const item = offer.items[0];
    const price = toFiniteNumber(offer.fixedPrice);
    if (!item || price == null) {
      continue;
    }

    result.set(item.variantId, price);
  }

  return result;
}

