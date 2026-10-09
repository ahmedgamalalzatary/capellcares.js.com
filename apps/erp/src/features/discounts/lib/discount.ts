import type { ProductVariant } from "@capella/shared";

export type VariantDiscountState = NonNullable<ProductVariant["discount"]>;

export function inCategory(categoryId: number, selected: Set<number>, parents: Map<number, number | null>) {
  let current: number | null | undefined = categoryId;
  const seen = new Set<number>();
  while (current != null && !seen.has(current)) {
    if (selected.has(current)) return true;
    seen.add(current);
    current = parents.get(current);
  }
  return false;
}

export function toggleId(current: number[], id: number) {
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

export function previewPrice(price: number, type: "percentage" | "fixed", value: number) {
  if (!Number.isFinite(value) || value <= 0) return price;
  return Math.max(0, Number((type === "percentage" ? price * (1 - value / 100) : price - value).toFixed(2)));
}

export function toDateTimeLocal(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function toIsoOrEmpty(value: string) {
  return value ? new Date(value).toISOString() : "";
}

export function buildDiscountState(variant: ProductVariant): VariantDiscountState {
  return variant.discount ?? {
    type: "percentage",
    value: 0,
    startsAt: "",
    endsAt: "",
    status: "inactive"
  };
}
