import type { Offer, Product } from "../types/index.js";
import { products } from "./products.js";

const now = "2026-01-15T10:00:00Z";

function priceOfVariant(id: number) {
  for (const p of products) {
    const v = p.variants.find((v: Product["variants"][number]) => v.id === id);
    if (v) return v.price;
  }
  return 0;
}

function originalTotal(items: { variantId: number; qty: number }[]) {
  return items.reduce((acc, it) => acc + priceOfVariant(it.variantId) * it.qty, 0);
}

export const offers: Offer[] = [
  {
    id: 1,
    slug: "rose-ritual-bundle",
    name: { ar: "طقوس الورد", en: "Rose Ritual Bundle" },
    description: {
      ar: "لوشن الورد مع بلسم الشفاه بسعر باقة.",
      en: "Our rose body lotion paired with vanilla-honey lip balm at a bundle price."
    },
    imagePath: "/images/offers/rose-ritual.svg",
    items: [
      { variantId: 12, qty: 1 },
      { variantId: 51, qty: 1 }
    ],
    price: 380,
    originalTotal: originalTotal([
      { variantId: 12, qty: 1 },
      { variantId: 51, qty: 1 }
    ]),
    stock: 12,
    status: "active",
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  },
  {
    id: 2,
    slug: "glow-routine",
    name: { ar: "روتين الإشراق", en: "Glow Routine" },
    description: {
      ar: "سيروم فيتامين سي مع زيت الأرغان لإشراق طبيعي.",
      en: "Vitamin C serum + Argan hair oil for a head-to-toe glow."
    },
    imagePath: "/images/offers/glow-routine.svg",
    items: [
      { variantId: 21, qty: 1 },
      { variantId: 31, qty: 1 }
    ],
    price: 580,
    originalTotal: originalTotal([
      { variantId: 21, qty: 1 },
      { variantId: 31, qty: 1 }
    ]),
    stock: 18,
    status: "active",
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  },
  {
    id: 3,
    slug: "weekend-pamper",
    name: { ar: "تدليل عطلة الأسبوع", en: "Weekend Pamper Box" },
    description: {
      ar: "صابون الشوفان، مقشر القهوة، وشمعة العنبر.",
      en: "Oatmeal soap, coffee scrub, and an amber candle — a quiet Saturday in a box."
    },
    imagePath: "/images/offers/weekend-pamper.svg",
    items: [
      { variantId: 71, qty: 1 },
      { variantId: 41, qty: 1 },
      { variantId: 81, qty: 1 }
    ],
    price: 360,
    originalTotal: originalTotal([
      { variantId: 71, qty: 1 },
      { variantId: 41, qty: 1 },
      { variantId: 81, qty: 1 }
    ]),
    stock: 10,
    status: "active",
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  }
];

const bySlug = new Map(offers.map((o) => [o.slug, o]));

export function getOfferBySlug(slug: string): Offer | undefined {
  return bySlug.get(slug);
}

export function getOffersForProduct(productId: number) {
  const variantIds = new Set(products.find((p) => p.id === productId)?.variants.map((v: Product["variants"][number]) => v.id) ?? []);
  return offers.filter((o) => o.items.some((it: Offer["items"][number]) => variantIds.has(it.variantId)));
}
