import type { Order, Product } from "../types/domain.js";

export const products: Product[] = [
  {
    id: 1,
    slug: "rose-body-lotion",
    sku: "BODY-LOTION-ROSE-200ML",
    arName: "لوشن الورد",
    enName: "Rose Body Lotion",
    keywords: ["rose", "body", "lotion"],
    imagePath: "/images/rose-lotion.jpg",
    categorySlug: "body-lotion",
    status: "active",
    deletedAt: null,
    variants: [
      { id: "v-1", sizeLabel: "100ml", sellingPrice: 120, stockQty: 10 },
      { id: "v-2", sizeLabel: "200ml", sellingPrice: 180, stockQty: 0 }
    ]
  }
];

export const orders: Order[] = [];
