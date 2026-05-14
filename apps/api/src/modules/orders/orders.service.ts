import { orders, products } from "../../data/store.js";
import type { CheckoutPayload, Order, PaymentStatus } from "../../types/domain.js";

export function createOrderFromCheckout(payload: CheckoutPayload): Order {
  const pricedItems = payload.items.map((item) => {
    const product = products.find((p) => p.variants.some((v) => v.id === item.variantId));
    const variant = product?.variants.find((v) => v.id === item.variantId);
    if (!variant) throw new Error(`Variant not found: ${item.variantId}`);
    if (item.qty <= 0) throw new Error("Quantity must be positive");
    if (variant.stockQty < item.qty) throw new Error("Insufficient stock");
    return {
      variant,
      qty: item.qty,
      unitPrice: variant.sellingPrice,
      lineTotal: variant.sellingPrice * item.qty
    };
  });

  const totalAmount = pricedItems.reduce((sum, row) => sum + row.lineTotal, 0);
  const paymentStatus: PaymentStatus = payload.paymentMethod === "paymob" ? "pending" : "pending";
  const order: Order = {
    id: orders.length + 1,
    customerType: payload.customerId ? "registered" : "guest",
    customerId: payload.customerId ?? null,
    fullName: payload.fullName,
    phone: payload.phone,
    email: payload.email,
    governorate: payload.governorate,
    cityArea: payload.cityArea,
    addressLine: payload.addressLine,
    buildingApartment: payload.buildingApartment,
    notes: payload.notes,
    paymentMethod: payload.paymentMethod,
    paymentStatus,
    totalAmount,
    createdAt: new Date().toISOString(),
    items: pricedItems.map((r) => ({
      variantId: r.variant.id,
      qty: r.qty,
      unitPrice: r.unitPrice,
      lineTotal: r.lineTotal
    }))
  };

  for (const row of pricedItems) row.variant.stockQty -= row.qty;
  orders.push(order);
  return order;
}
