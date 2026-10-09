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

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ar-EG-u-nu-latn", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateShort(value: string) {
  return new Date(value).toLocaleDateString("ar-EG-u-nu-latn");
}

/** Local-time `YYYY-MM-DD` key, used to bucket records by calendar day. */
export function localDateKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
