import Link from "next/link";
import { getProductBadgeState, type Product } from "@capella/shared";

/** Every kind of merchandising tag the storefront can show on an item. */
export type ItemTagKind = "new" | "bestseller" | "offer" | "collection" | "outOfStock";

export interface ItemTag {
  kind: ItemTagKind;
  label: string;
  /** When set the pill becomes a link (used for offer badges on the product page). */
  href?: string;
  /** Prefix the label with a ★ (offer / collection badges). */
  star?: boolean;
}

type Variant = "float" | "badge";

// Floating accent pill — sits on top of an illustration (cards, detail images).
// Default sizing matches the roomy 1-col card. When the pill sits inside a grid
// flagged `data-cols="2"` (the dense POV layout) it shrinks via group-data so the
// tag stays proportional to the smaller card.
const FLOAT_BASE =
  "inline-flex items-center text-xs uppercase text-canvas px-3 tracking-[0.16em] py-1.5 " +
  "group-data-[cols=2]/cards:px-2 group-data-[cols=2]/cards:py-1 group-data-[cols=2]/cards:text-[10px] group-data-[cols=2]/cards:tracking-[0.06em]";
const FLOAT_BG: Record<ItemTagKind, string> = {
  new: "bg-accent",
  bestseller: "bg-accent",
  offer: "bg-accent",
  collection: "bg-accent",
  outOfStock: "bg-ink",
};

// Inline CSS badge row (product detail) — colours defined in globals.css.
const BADGE_CLASS: Record<ItemTagKind, string> = {
  new: "badge badge--new",
  bestseller: "badge badge--gold",
  offer: "badge badge--offer",
  collection: "badge badge--offer",
  outOfStock: "badge",
};

function pillClass(tag: ItemTag, variant: Variant, className?: string): string {
  const floatPointerClass = tag.href ? "" : " pointer-events-none";
  const base = variant === "badge" ? BADGE_CLASS[tag.kind] : `${FLOAT_BASE}${floatPointerClass} ${FLOAT_BG[tag.kind]}`;
  return className ? `${base} ${className}` : base;
}

function Body({ tag }: { tag: ItemTag }) {
  return (
    <>
      {tag.star ? <span aria-hidden="true">★</span> : null}
      {tag.label}
    </>
  );
}

/** Renders a single tag pill. Becomes a link when `tag.href` is set. */
export function ItemTagPill({
  tag,
  variant = "float",
  className,
}: {
  tag: ItemTag;
  variant?: Variant;
  className?: string;
}) {
  if (tag.href) {
    return (
      <Link href={tag.href} className={pillClass(tag, variant, className)}>
        <Body tag={tag} />
      </Link>
    );
  }
  return (
    <span className={pillClass(tag, variant, className)}>
      <Body tag={tag} />
    </span>
  );
}

/** Renders a list of tags inside a flex wrapper. */
export function ItemTags({
  tags,
  variant = "badge",
  className,
  pillClassName,
}: {
  tags: ItemTag[];
  variant?: Variant;
  /** Applied to the wrapping flex container. */
  className?: string;
  /** Applied to every pill. */
  pillClassName?: string;
}) {
  if (tags.length === 0) {
    return null;
  }
  return (
    <div className={className ?? "flex flex-wrap gap-2"}>
      {tags.map((tag) => (
        <ItemTagPill key={`${tag.kind}-${tag.label}-${tag.href ?? ""}-${tag.star ? "star" : "plain"}`} tag={tag} variant={variant} className={pillClassName} />
      ))}
    </div>
  );
}

/**
 * Derives a product's merchandising tags from its badge state.
 * - `lead: true`  → a single highest-priority tag (the floating card label).
 * - `lead: false` → new + bestseller (the product page badge row; offers are
 *   rendered separately there as links).
 */
export function getProductTags(
  product: Product,
  dict: any,
  options?: { lead?: boolean }
): ItemTag[] {
  const { isNew, isBestseller, isOffer } = getProductBadgeState(product);
  const newTag: ItemTag = { kind: "new", label: dict.badges.new };
  const bestsellerTag: ItemTag = { kind: "bestseller", label: dict.badges.bestseller };

  if (options?.lead) {
    if (isNew) return [newTag];
    if (isBestseller) return [bestsellerTag];
    if (isOffer) return [{ kind: "offer", label: dict.badges.offer }];
    return [];
  }

  const tags: ItemTag[] = [];
  if (isNew) tags.push(newTag);
  if (isBestseller) tags.push(bestsellerTag);
  return tags;
}
