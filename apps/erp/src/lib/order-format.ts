import { CURRENCY } from "@capella/shared";

const orderCurrency = new Intl.NumberFormat("ar-EG", {
  style: "currency", currency: CURRENCY, minimumFractionDigits: 0, maximumFractionDigits: 2
});

export function formatOrderAmount(amount: number) {
  return orderCurrency.format(amount);
}
