/**
 * Slugify a form name to an ASCII-only kebab-case slug.
 *
 * ASCII-only: non-ASCII characters (Arabic, accented Latin, CJK, etc.) are
 * stripped via the `[^a-z0-9]+` collapse. Callers that need non-ASCII input
 * should pass the English (en) name, or transliterate first.
 */
export function slugifyFormName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
