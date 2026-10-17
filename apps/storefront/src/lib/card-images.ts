import { resolveLocalizedEntityMediaUrl, type EntityMedia, type Language } from "@capella/shared";

type CardImageSource = {
  imagePath?: string | null;
  media?: EntityMedia[] | null;
};

/**
 * The pictures a storefront card swipes through: the main image first, then the rest of the
 * gallery in its ERP order. The hover image is not one of them (it belongs to the desktop hover
 * swap), videos stay on the detail page, and an image that appears twice (the main image is
 * usually also the first gallery item) is shown once.
 */
export function buildCardImages({ imagePath, media }: CardImageSource, lang: Language): string[] {
  const gallery = (media ?? [])
    .filter((item) => item.type === "image")
    .map((item) => resolveLocalizedEntityMediaUrl(item, lang));
  const primary = gallery[0] || imagePath || "";
  return Array.from(new Set([primary, ...gallery].filter(Boolean)));
}
