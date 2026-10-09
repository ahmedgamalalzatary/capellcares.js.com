import { describe, expect, it } from "vitest";
import type { OrderSummary, Product } from "@capella/shared";
import { catalogHealth, daysPhrase, endingDiscounts, paymentSplit, salesPulse, slowMovers, stockAlerts, topSellers } from "@/features/dashboard/lib/metrics";

// Local-time dates keep the day/hour boundaries independent of the machine's time zone.
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();
const sale = (orderId: number, createdAt: string, totalAmount: number, unitsSold: number) => ({
  orderId,
  orderCode: `S-${orderId}`,
  paymentStatus: "accepted" as const,
  totalAmount,
  unitsSold,
  createdAt,
  items: []
});

const now = new Date(2026, 9, 9, 14, 0);
const sales = [
  sale(1, at(9, 10), 100, 2),
  sale(2, at(9, 13, 30), 50, 1),
  sale(3, at(8, 12), 80, 1),
  sale(4, at(3, 9), 40, 1),
  sale(5, at(1, 9), 200, 1)
];

describe("salesPulse", () => {
  it("sums today's sales hour by hour and compares them with yesterday", () => {
    const pulse = salesPulse(sales, "today", now);

    expect(pulse).toMatchObject({ revenue: 150, previousRevenue: 80, change: 0.875, orderCount: 2, units: 3, averageOrder: 75 });
    expect(pulse.series).toHaveLength(24);
    expect(pulse.series[10]).toBe(100);
    expect(pulse.series[13]).toBe(50);
    expect(pulse.series.reduce((sum, value) => sum + value, 0)).toBe(150);
  });

  it("covers the last seven days including today, day by day, against the seven before", () => {
    const pulse = salesPulse(sales, "7d", now);

    expect(pulse).toMatchObject({ revenue: 270, previousRevenue: 200, change: 0.35, orderCount: 4, units: 5, averageOrder: 67.5 });
    expect(pulse.series).toEqual([40, 0, 0, 0, 0, 80, 150]);
  });

  it("has no change figure when the previous period sold nothing", () => {
    const pulse = salesPulse(sales, "30d", now);

    expect(pulse.revenue).toBe(470);
    expect(pulse.previousRevenue).toBe(0);
    expect(pulse.change).toBeNull();
    expect(pulse.series).toHaveLength(30);
  });

  it("reports zero average when nothing sold", () => {
    expect(salesPulse([], "7d", now)).toMatchObject({ revenue: 0, orderCount: 0, averageOrder: 0, change: null });
  });
});

const order = (id: number, createdAt: string, payment: Pick<OrderSummary, "paymentMethod" | "paymentStatus" | "providerPaymentStatus">): OrderSummary => ({
  id, orderCode: `O-${id}`, customerType: "guest", customerId: null, fullName: "Customer", phone: "01000000000", email: "c@example.com",
  governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street", buildingApartment: "1", notes: null,
  refundedAmountCents: 0, totalAmount: 100, createdAt, ...payment
});

describe("paymentSplit", () => {
  const orders = [
    order(1, at(9, 9), { paymentMethod: "cod", paymentStatus: "pending", providerPaymentStatus: null }),
    order(2, at(9, 9), { paymentMethod: "cod", paymentStatus: "accepted", providerPaymentStatus: null }),
    order(3, at(8, 9), { paymentMethod: "cod", paymentStatus: "denied", providerPaymentStatus: null }),
    // Paymob orders are judged by the provider's status, not the stored payment status.
    order(4, at(7, 9), { paymentMethod: "paymob", paymentStatus: "pending", providerPaymentStatus: "succeeded" }),
    order(5, at(7, 9), { paymentMethod: "paymob", paymentStatus: "pending", providerPaymentStatus: "failed" }),
    order(6, at(6, 9), { paymentMethod: "paymob", paymentStatus: "pending", providerPaymentStatus: null }),
    order(7, at(1, 9), { paymentMethod: "cod", paymentStatus: "accepted", providerPaymentStatus: null })
  ];

  it("counts orders by payment outcome since the given time", () => {
    expect(paymentSplit(orders, new Date(2026, 9, 3))).toEqual({ accepted: 2, pending: 2, denied: 2 });
  });

  it("counts every order when no start is given", () => {
    expect(paymentSplit(orders, null)).toEqual({ accepted: 3, pending: 2, denied: 2 });
  });
});

const product = (id: number, overrides: Partial<Product> = {}): Product => ({
  id, sku: `SKU-${id}`, slug: `p-${id}`, name: { ar: `منتج ${id}`, en: `Product ${id}` },
  description: { ar: "وصف", en: "Description" }, ingredients: { ar: "", en: "" }, howToUse: { ar: "", en: "" }, warnings: { ar: "", en: "" },
  keywords: ["k"], buyingPrice: 10, imagePath: "/p.jpg", status: "active", isNew: false, isBestseller: false, categoryId: 1,
  variants: [{ id: id * 10, productId: id, size: "100ml", price: 50, stock: 10 }],
  createdAt: new Date(2026, 0, 1).toISOString(), updatedAt: at(1, 0), deletedAt: null,
  ...overrides
});
const line = (productId: number, unitsSold: number) => ({ label: `Product ${productId} / 100ml`, productId, variantId: productId * 10, unitsSold });
const saleWith = (orderId: number, createdAt: string, items: ReturnType<typeof line>[]) => ({ ...sale(orderId, createdAt, 0, 0), items });

describe("topSellers", () => {
  const products = [product(1), product(2), product(3)];
  const withItems = [
    saleWith(1, at(9, 9), [line(1, 2), line(2, 1)]),
    saleWith(2, at(8, 9), [line(2, 4)]),
    saleWith(3, at(1, 9), [line(3, 9)])
  ];

  it("ranks products by units sold since the start, under their Arabic name", () => {
    expect(topSellers(withItems, new Date(2026, 9, 3), products, 5)).toEqual([
      { productId: 2, name: "منتج 2", units: 5 },
      { productId: 1, name: "منتج 1", units: 2 }
    ]);
  });

  it("keeps only the requested number of products", () => {
    expect(topSellers(withItems, new Date(2026, 8, 1), products, 1)).toEqual([{ productId: 3, name: "منتج 3", units: 9 }]);
  });

  it("falls back to the sold label when the product is no longer in the catalog", () => {
    expect(topSellers([saleWith(4, at(9, 9), [line(9, 1)])], new Date(2026, 9, 3), products, 5))
      .toEqual([{ productId: 9, name: "Product 9", units: 1 }]);
  });
});

describe("slowMovers", () => {
  it("lists active in-stock products that sold nothing in the last 30 days", () => {
    const products = [
      product(1),
      product(2),
      product(3, { status: "inactive" }),
      product(4, { deletedAt: at(2, 9) }),
      product(5, { variants: [{ id: 50, productId: 5, size: "100ml", price: 50, stock: 0 }] }),
      // Too new to judge: added inside the window.
      product(6, { createdAt: at(1, 9) })
    ];
    const recent = [saleWith(1, at(9, 9), [line(1, 1)]), saleWith(2, new Date(2026, 8, 1).toISOString(), [line(2, 3)])];

    expect(slowMovers(products, recent, now, 30).map((item) => item.id)).toEqual([2]);
  });
});

describe("stockAlerts", () => {
  const sizes = (id: number, ...stocks: number[]) => stocks.map((stock, index) => ({ id: id * 10 + index, productId: id, size: `${index + 1}`, price: 50, stock }));

  it("lists empty and nearly empty sizes, best sellers of the last 30 days first", () => {
    const products = [
      product(1, { variants: sizes(1, 0, 20) }),
      product(2, { variants: sizes(2, 3) }),
      product(3, { variants: sizes(3, 5) }),
      product(4, { variants: sizes(4, 0), deletedAt: at(2, 9) }),
      product(5, { variants: sizes(5, 6) })
    ];
    const recent = [
      saleWith(1, at(9, 9), [{ label: "x", productId: 3, variantId: 30, unitsSold: 7 }]),
      saleWith(2, at(8, 9), [{ label: "x", productId: 2, variantId: 20, unitsSold: 2 }]),
      // Older than 30 days: does not count.
      saleWith(3, new Date(2026, 7, 1).toISOString(), [{ label: "x", productId: 1, variantId: 10, unitsSold: 50 }])
    ];

    expect(stockAlerts(products, recent, now, 30).map(({ variant, level, sold }) => [variant.id, level, sold])).toEqual([
      [30, "low", 7],
      [20, "low", 2],
      [10, "out", 0]
    ]);
  });

  it("puts empty sizes before low ones when they sold the same", () => {
    const products = [product(1, { variants: sizes(1, 2) }), product(2, { variants: sizes(2, 0) })];

    expect(stockAlerts(products, [], now, 30).map(({ variant }) => variant.id)).toEqual([20, 10]);
  });
});

describe("endingDiscounts", () => {
  const discount = (startsAt: string, endsAt: string, status: "active" | "inactive" = "active") =>
    ({ type: "percentage" as const, value: 10, startsAt, endsAt, status });
  const bundle = (id: number, name: string, value: ReturnType<typeof discount> | null, deletedAt: string | null = null) =>
    ({ id, name: { ar: name, en: name }, discount: value, deletedAt });

  it("lists running discounts that end within the next 7 days, soonest first, with where to edit them", () => {
    const products = [
      product(1, { variants: [
        { id: 10, productId: 1, size: "50ml", price: 50, stock: 1, discount: discount(at(1, 0), at(14, 0)) },
        { id: 11, productId: 1, size: "100ml", price: 90, stock: 1, discount: discount(at(1, 0), at(11, 0)) }
      ] }),
      // Ends after the 7-day horizon.
      product(2, { variants: [{ id: 20, productId: 2, size: "50ml", price: 50, stock: 1, discount: discount(at(1, 0), at(20, 0)) }] }),
      // Switched off.
      product(3, { variants: [{ id: 30, productId: 3, size: "50ml", price: 50, stock: 1, discount: discount(at(1, 0), at(10, 0), "inactive") }] })
    ];
    const offers = [
      bundle(7, "عرض الصيف", discount(at(1, 0), at(10, 0))),
      // Not started yet.
      bundle(8, "عرض قادم", discount(at(12, 0), at(13, 0))),
      bundle(9, "عرض محذوف", discount(at(1, 0), at(10, 0)), at(2, 0))
    ];
    const collections = [
      bundle(4, "مجموعة العناية", discount(at(1, 0), at(15, 0))),
      // Already over.
      bundle(5, "مجموعة منتهية", discount(at(1, 0), at(9, 13)))
    ];

    expect(endingDiscounts({ products, offers, collections }, now, 7)).toEqual([
      { key: "offer-7", name: "عرض الصيف", endsAt: at(10, 0), href: "/offers/7/edit" },
      { key: "product-1", name: "منتج 1", endsAt: at(11, 0), href: "/products/1/discount" },
      { key: "collection-4", name: "مجموعة العناية", endsAt: at(15, 0), href: "/collections/4/edit" }
    ]);
  });
});

describe("catalogHealth", () => {
  it("lists the products missing each detail and scores the share of details filled", () => {
    const products = [
      product(1),
      product(2, { imagePath: "", media: [], name: { ar: "منتج 2", en: " " } }),
      // Has gallery media, so it is not missing an image.
      product(3, { imagePath: "", media: [{ type: "image", arUrl: "/g.jpg", enUrl: null }], keywords: [] }),
      product(4, { description: { ar: "وصف", en: "" } }),
      product(5, { imagePath: "", deletedAt: at(2, 0) })
    ];

    const health = catalogHealth(products);

    expect(health.score).toBe(75);
    expect(Object.fromEntries(Object.entries(health.missing).map(([key, list]) => [key, list.map((item) => item.id)]))).toEqual({
      image: [2],
      englishName: [2],
      description: [4],
      keywords: [3]
    });
  });

  it("has no score for an empty catalog", () => {
    expect(catalogHealth([]).score).toBeNull();
  });
});

describe("daysPhrase", () => {
  it("counts days the Arabic way", () => {
    expect([1, 2, 3, 10, 11, 29].map(daysPhrase)).toEqual(["يوم", "يومين", "3 أيام", "10 أيام", "11 يومًا", "29 يومًا"]);
  });
});
