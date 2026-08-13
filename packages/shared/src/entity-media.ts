import type { EntityMedia, Language } from "./types/index.js";

export function resolveLocalizedEntityMediaUrl(media: EntityMedia, lang: Language): string {
  if (media.type === "video") return media.url;
  return lang === "ar"
    ? media.arUrl ?? media.enUrl ?? ""
    : media.enUrl ?? media.arUrl ?? "";
}
