import type { ProductColor, ProductVariant, VariantDiscount } from "@capella/shared";

/** One size row of the editor: every colour of a size shares its price and discount. An empty label means "no sizes". */
export type SizeRow = {
  key: number;
  label: string;
  price: number;
  discount: VariantDiscount | null;
};

export type VariantMatrix = {
  sizes: SizeRow[];
  /** Stock per cellKey(size, colour). */
  stock: Record<string, number>;
  /** Stored variant id per cellKey, so a re-save keeps the same variants. */
  variantIds: Record<string, number>;
};

/** What stops the sizes/colours from being saved, or null when they are fine. */
export type MatrixProblem = "price" | "size-name" | "size-repeat" | "color";

// Negative, monotonically-decreasing temp ids never collide with positive DB autoincrement ids.
let tempId = 0;
export function newTempId() {
  tempId -= 1;
  return tempId;
}

export function cellKey(sizeKey: number, colorId: number | null | undefined) {
  return `${sizeKey}|${colorId ?? 0}`;
}

function normalizeLabel(label: string) {
  return label.trim().replace(/\s+/g, " ");
}

export function emptySize(): SizeRow {
  return { key: newTempId(), label: "", price: 0, discount: null };
}

export function matrixFromVariants(variants: ProductVariant[]): VariantMatrix {
  const sizes: SizeRow[] = [];
  const stock: Record<string, number> = {};
  const variantIds: Record<string, number> = {};
  const byLabel = new Map<string, SizeRow>();
  const ordered = variants.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  for (const variant of ordered) {
    const label = normalizeLabel(variant.size);
    let size = byLabel.get(label.toLowerCase());
    if (!size) {
      size = { key: newTempId(), label, price: variant.price, discount: variant.discount ?? null };
      byLabel.set(label.toLowerCase(), size);
      sizes.push(size);
    }
    const key = cellKey(size.key, variant.colorId);
    stock[key] = variant.stock;
    if (variant.id > 0) variantIds[key] = variant.id;
  }

  return { sizes: sizes.length > 0 ? sizes : [emptySize()], stock, variantIds };
}

export function variantsFromMatrix(matrix: VariantMatrix, colors: ProductColor[], productId: number): ProductVariant[] {
  const colorIds: Array<number | null> = colors.length > 0 ? colors.map((color) => color.id) : [null];
  let sortOrder = 0;
  return matrix.sizes.flatMap((size) => colorIds.map((colorId): ProductVariant => {
    const key = cellKey(size.key, colorId);
    sortOrder += 1;
    return {
      id: matrix.variantIds[key] ?? newTempId(),
      productId,
      size: normalizeLabel(size.label),
      colorId,
      price: Math.max(0, size.price),
      stock: Math.max(0, matrix.stock[key] ?? 0),
      sortOrder,
      discount: size.discount
    };
  }));
}

export function colorIsValid(color: Pick<ProductColor, "hex" | "name">) {
  return Boolean(color.hex || color.name.ar.trim() || color.name.en.trim());
}

export function matrixProblem(sizes: SizeRow[], colors: ProductColor[]): MatrixProblem | null {
  if (sizes.length === 0 || sizes.some((size) => !(size.price > 0))) return "price";
  if (sizes.length > 1) {
    const labels = sizes.map((size) => normalizeLabel(size.label).toLowerCase());
    if (labels.some((label) => !label)) return "size-name";
    if (new Set(labels).size !== labels.length) return "size-repeat";
  }
  if (colors.some((color) => !colorIsValid(color))) return "color";
  return null;
}

/** The variants of each size together (every colour of a size shares its price and discount), in variant order. */
export function groupVariantsBySize(variants: ProductVariant[]): ProductVariant[][] {
  const groups = new Map<string, ProductVariant[]>();
  const ordered = variants.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const variant of ordered) {
    const key = normalizeLabel(variant.size).toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), variant]);
  }
  return [...groups.values()];
}
