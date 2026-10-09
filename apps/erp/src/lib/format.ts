// One number style across the ERP: Latin tabular digits (what staff type into inputs and what SKUs use),
// with the Arabic currency label. Pair with the `num` class for aligned columns.
const numberFormat = new Intl.NumberFormat("en-EG", { maximumFractionDigits: 2 });

export function formatNumber(value: number) {
  return numberFormat.format(value);
}

export function formatMoney(value: number) {
  return `${numberFormat.format(value)} ج.م`;
}

export function formatMoneyRange(min: number, max: number) {
  return min === max ? formatMoney(min) : `${numberFormat.format(min)} – ${formatMoney(max)}`;
}
