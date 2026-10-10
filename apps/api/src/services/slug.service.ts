import { randomBytes } from "node:crypto";

export function toSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const DRAFT_SLUG = /^draft-[0-9a-f]{8}$/;

/** Slug for a product/offer/collection: the requested slug, else the English name; an Arabic-only draft gets a temporary `draft-xxxxxxxx` slug that is swapped for the English one once it exists. */
export function resolveEntitySlug(requested: unknown, enName: unknown): string {
  const requestedSlug = toSlug(typeof requested === "string" ? requested : "");
  if (requestedSlug && !DRAFT_SLUG.test(requestedSlug)) {
    return requestedSlug;
  }
  const englishSlug = toSlug(typeof enName === "string" ? enName : "");
  return englishSlug || requestedSlug || `draft-${randomBytes(4).toString("hex")}`;
}
