// Promo code pricing (docs/promo-codes-spec.md sections 4.1-4.3). Pure: callers load the code, the customer's usage and the
// priced cart lines, and this decides whether the code applies and what every line costs with it. Money is handled in
// piastres (integer cents) internally so the line discounts always add up to exactly the order's discount.

export type PromoTargetType = "category" | "product" | "variant" | "offer" | "collection";
export type PromoTarget = { type: PromoTargetType; id: number };

export type PromoRules = {
  discountType: "percentage" | "fixed" | null;
  discountValue: number | null;
  /** Percentage codes only: the most the code may take off the whole order, in EGP. */
  maxDiscountAmount: number | null;
  freeShipping: boolean;
  hasGift: boolean;
  eligibility: { scope: "all" | "selected"; include: PromoTarget[]; exclude: PromoTarget[] };
  minOrderAmount: number | null;
  maxOrderAmount: number | null;
  minEligiblePieces: number | null;
  maxDiscountedPieces: number | null;
};

/** One cart line as priced today (sale discounts already applied). Prices are in EGP. */
export type PromoLine = {
  key: string;
  itemType: "product_variant" | "offer" | "collection";
  variantId: number | null;
  productId: number | null;
  /** The product's category and every ancestor, so a code on a parent category covers its sub-categories. */
  categoryIds: number[];
  offerId: number | null;
  collectionId: number | null;
  qty: number;
  originalUnitPrice: number;
  /** Current unit price: the sale price when a sale applies, otherwise the original. */
  unitPrice: number;
  lineTotal: number;
  saleDiscountId: number | null;
};

export type PromoPricingContext = { shippingAvailable: boolean; giftAvailable: boolean };

export type PromoPricedLine = {
  key: string;
  /** The original price once any piece of the line is discounted by the code; otherwise unchanged. */
  unitPrice: number;
  /** What the customer pays for the whole line. May differ from unitPrice x qty; always display this, never recompute. */
  lineTotal: number;
  discountedPieces: number;
  /** What the code takes off the original price of the discounted pieces. */
  promoDiscount: number;
  /** Sale saving dropped on the discounted pieces because the code replaced it. */
  saleGivenUp: number;
  replacedSaleDiscountId: number | null;
};

export type PromoRejection =
  | { ok: false; reason: "below_min"; missingAmount: number }
  | { ok: false; reason: "above_max"; maxAmount: number }
  | { ok: false; reason: "min_pieces"; missingPieces: number }
  | { ok: false; reason: "no_effect" | "free_shipping_unavailable" | "gift_unavailable" };

export type PromoPricingResult =
  | {
    ok: true;
    lines: PromoPricedLine[];
    discountCents: number;
    saleGivenUpCents: number;
    freeShipping: boolean;
    gift: boolean;
    /** Lines whose sale the code removed, with their price before and after, for the customer's confirmation. */
    replacedSales: Array<{ key: string; previousLineTotal: number; lineTotal: number }>;
  }
  | PromoRejection;

const toCents = (value: number) => Math.round(value * 100);
const toMoney = (cents: number) => cents / 100;

function matchesTarget(line: PromoLine, target: PromoTarget): boolean {
  switch (target.type) {
    // A product inside an offer or collection is never eligible through that bundle: only direct product lines match these.
    case "variant": return line.itemType === "product_variant" && line.variantId === target.id;
    case "product": return line.itemType === "product_variant" && line.productId === target.id;
    case "category": return line.itemType === "product_variant" && line.categoryIds.includes(target.id);
    case "offer": return line.itemType === "offer" && line.offerId === target.id;
    case "collection": return line.itemType === "collection" && line.collectionId === target.id;
  }
}

export function isPromoEligible(line: PromoLine, eligibility: PromoRules["eligibility"]): boolean {
  if (eligibility.exclude.some((target) => matchesTarget(line, target))) return false;
  return eligibility.scope === "all" || eligibility.include.some((target) => matchesTarget(line, target));
}

/** Splits totalCents over weights in proportion, flooring each share and handing leftover piastres to the largest remainders (ties: the larger weight, then the earlier entry). */
function allocate(totalCents: number, exactShares: number[], weights: number[]): number[] {
  const floors = exactShares.map((share) => Math.floor(share + 1e-9));
  let leftover = totalCents - floors.reduce((sum, value) => sum + value, 0);
  const order = exactShares
    .map((share, index) => ({ index, remainder: share - floors[index]!, weight: weights[index]! }))
    .sort((a, b) => b.remainder - a.remainder || b.weight - a.weight || a.index - b.index);
  for (const entry of order) {
    if (leftover <= 0) break;
    floors[entry.index]! += 1;
    leftover -= 1;
  }
  return floors;
}

export function applyPromoPricing(rules: PromoRules, lines: PromoLine[], context: PromoPricingContext): PromoPricingResult {
  // Order amount range: the cart as shown (sale prices, before the code, without shipping or the gift).
  const shownCents = lines.reduce((sum, line) => sum + toCents(line.lineTotal), 0);
  if (rules.minOrderAmount !== null && shownCents < toCents(rules.minOrderAmount)) {
    return { ok: false, reason: "below_min", missingAmount: toMoney(toCents(rules.minOrderAmount) - shownCents) };
  }
  if (rules.maxOrderAmount !== null && shownCents > toCents(rules.maxOrderAmount)) {
    return { ok: false, reason: "above_max", maxAmount: rules.maxOrderAmount };
  }

  // Every eligible piece separately (qty 3 = 3 pieces).
  const pieces = lines.flatMap((line, lineIndex) => isPromoEligible(line, rules.eligibility)
    ? Array.from({ length: line.qty }, () => ({ lineIndex, originalCents: toCents(line.originalUnitPrice) }))
    : []);
  if (rules.minEligiblePieces !== null && pieces.length < rules.minEligiblePieces) {
    return { ok: false, reason: "min_pieces", missingPieces: rules.minEligiblePieces - pieces.length };
  }

  // Both percentage and fixed discounts scale with the original price, so the biggest saving against the original
  // price is simply the most expensive pieces first (ties keep cart order).
  let chosen = rules.discountType && rules.discountValue ? pieces : [];
  if (rules.maxDiscountedPieces !== null && chosen.length > rules.maxDiscountedPieces) {
    chosen = [...chosen].sort((a, b) => b.originalCents - a.originalCents || a.lineIndex - b.lineIndex).slice(0, rules.maxDiscountedPieces);
  }

  const chosenOriginalCents = chosen.reduce((sum, piece) => sum + piece.originalCents, 0);
  let discountCents = 0;
  if (rules.discountType === "percentage" && rules.discountValue) {
    discountCents = Math.round(chosenOriginalCents * rules.discountValue / 100);
    if (rules.maxDiscountAmount !== null) discountCents = Math.min(discountCents, toCents(rules.maxDiscountAmount));
  } else if (rules.discountType === "fixed" && rules.discountValue) {
    discountCents = Math.min(toCents(rules.discountValue), chosenOriginalCents);
  }

  const freeShipping = rules.freeShipping && context.shippingAvailable;
  const gift = rules.hasGift && context.giftAvailable;
  if (chosen.length === 0 || discountCents === 0) {
    if (!freeShipping && !gift) {
      if (rules.freeShipping && !context.shippingAvailable && !rules.discountType && !rules.hasGift) return { ok: false, reason: "free_shipping_unavailable" };
      if (rules.hasGift && !context.giftAvailable && !rules.discountType && !rules.freeShipping) return { ok: false, reason: "gift_unavailable" };
      return { ok: false, reason: "no_effect" };
    }
    chosen = [];
    discountCents = 0;
  }

  // Each line's share of the discount, in proportion to the original price of its discounted pieces.
  const chosenByLine = lines.map((_, index) => chosen.filter((piece) => piece.lineIndex === index));
  const lineOriginalCents = chosenByLine.map((linePieces) => linePieces.reduce((sum, piece) => sum + piece.originalCents, 0));
  const exactShares = lineOriginalCents.map((cents) => chosenOriginalCents === 0 ? 0 : discountCents * cents / chosenOriginalCents);
  const lineDiscountCents = allocate(discountCents, exactShares, lines.map((line) => toCents(line.originalUnitPrice)));

  let saleGivenUpCents = 0;
  const replacedSales: Array<{ key: string; previousLineTotal: number; lineTotal: number }> = [];
  const pricedLines = lines.map((line, index): PromoPricedLine => {
    const discounted = chosenByLine[index]!.length;
    if (discounted === 0) {
      return { key: line.key, unitPrice: line.unitPrice, lineTotal: line.lineTotal, discountedPieces: 0, promoDiscount: 0, saleGivenUp: 0, replacedSaleDiscountId: null };
    }
    const untouchedCents = (line.qty - discounted) * toCents(line.unitPrice);
    const lineTotalCents = lineOriginalCents[index]! - lineDiscountCents[index]! + untouchedCents;
    const saleGivenUp = discounted * (toCents(line.originalUnitPrice) - toCents(line.unitPrice));
    saleGivenUpCents += saleGivenUp;
    const replacedSaleDiscountId = saleGivenUp > 0 ? line.saleDiscountId : null;
    if (replacedSaleDiscountId !== null) replacedSales.push({ key: line.key, previousLineTotal: line.lineTotal, lineTotal: toMoney(lineTotalCents) });
    return {
      key: line.key,
      unitPrice: line.originalUnitPrice,
      lineTotal: toMoney(lineTotalCents),
      discountedPieces: discounted,
      promoDiscount: toMoney(lineDiscountCents[index]!),
      saleGivenUp: toMoney(saleGivenUp),
      replacedSaleDiscountId
    };
  });

  return { ok: true, lines: pricedLines, discountCents, saleGivenUpCents, freeShipping, gift, replacedSales };
}

export type PromoAccessCode = {
  status: "active" | "paused" | "stopped";
  startsAt: Date;
  endsAt: Date | null;
  isPrivate: boolean;
  firstOrderOnly: boolean;
  totalUsageLimit: number | null;
  perCustomerLimit: number | null;
};

export type PromoAccessContext = {
  customerId: number | null;
  now: Date;
  onPrivateList: boolean;
  /** Any earlier order by this account or the checkout phone, including cancelled, denied or expired ones. */
  hasPreviousOrder: boolean;
  /** Reserved plus used redemptions of the code by everyone. */
  usedTotal: number;
  /** Reserved plus used redemptions by this account or its phone. */
  usedByCustomer: number;
};

export type PromoAccessFailure = "login_required" | "not_found" | "inactive" | "private" | "first_order" | "usage_limit" | "customer_limit";

/** Who may use the code right now (spec section 4.2, steps 1-8, first failure wins); null when allowed. */
export function validatePromoAccess(code: PromoAccessCode | null, context: PromoAccessContext): PromoAccessFailure | null {
  if (context.customerId === null) return "login_required";
  if (!code) return "not_found";
  if (code.status !== "active") return "inactive";
  if (context.now < code.startsAt || (code.endsAt !== null && context.now >= code.endsAt)) return "inactive";
  if (code.isPrivate && !context.onPrivateList) return "private";
  if (code.firstOrderOnly && context.hasPreviousOrder) return "first_order";
  if (code.totalUsageLimit !== null && context.usedTotal >= code.totalUsageLimit) return "usage_limit";
  if (code.perCustomerLimit !== null && context.usedByCustomer >= code.perCustomerLimit) return "customer_limit";
  return null;
}
