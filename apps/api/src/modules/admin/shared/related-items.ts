import type { RelatedEntityType, RelatedRef } from "../../../repositories/related-item.repository.js";

const RELATED_ENTITY_TYPES: RelatedEntityType[] = ["product", "offer", "collection"];

export function parseRelatedItems(value: unknown): RelatedRef[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const refs: RelatedRef[] = [];
  for (const item of value) {
    const type = (item as any)?.type;
    const id = Number((item as any)?.id);
    if (RELATED_ENTITY_TYPES.includes(type) && Number.isInteger(id) && id > 0) {
      const key = `${type}:${id}`;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push({ type, id });
      }
    }
  }
  return refs;
}
