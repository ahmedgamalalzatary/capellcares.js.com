export type OrderingSurface = "erp" | "storefront";

type RankedEntity = {
  id: number;
  sortOrder?: number | null;
  createdAt?: string | Date | null;
};

function normalizeRank(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeCreatedAt(value: string | Date | null | undefined) {
  const timestamp = value instanceof Date
    ? value.getTime()
    : value
      ? Date.parse(value)
      : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function compareByScopedOrdering<T extends RankedEntity>(
  surface: OrderingSurface,
  left: T,
  right: T
) {
  const leftRank = normalizeRank(left.sortOrder);
  const rightRank = normalizeRank(right.sortOrder);

  if (leftRank != null && rightRank != null) {
    return leftRank - rightRank || left.id - right.id;
  }

  if (leftRank != null) {
    return -1;
  }

  if (rightRank != null) {
    return 1;
  }

  const leftCreatedAt = normalizeCreatedAt(left.createdAt);
  const rightCreatedAt = normalizeCreatedAt(right.createdAt);
  if (leftCreatedAt != null && rightCreatedAt != null && leftCreatedAt !== rightCreatedAt) {
    // Business rule for unranked ERP items: keep older items first for now.
    if (surface === "erp") {
      return leftCreatedAt - rightCreatedAt;
    }

    // Business rule for unranked storefront items: keep newer items first for now.
    return rightCreatedAt - leftCreatedAt;
  }

  return left.id - right.id;
}
