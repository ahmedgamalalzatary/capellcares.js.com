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
/** A real calendar day written YYYY-MM-DD (what a date input produces). */
export function isDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]);
}

function localDay(key: string, hours: [number, number, number, number]) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, ...hours).toISOString();
}

/** First instant of a YYYY-MM-DD day in the viewer's time zone, for server date filters. */
export const localDayStart = (key: string) => localDay(key, [0, 0, 0, 0]);
/** Last instant of a YYYY-MM-DD day in the viewer's time zone, for server date filters. */
export const localDayEnd = (key: string) => localDay(key, [23, 59, 59, 999]);

export function localDateKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
