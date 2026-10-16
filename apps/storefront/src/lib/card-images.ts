import { resolveLocalizedEntityMediaUrl, type EntityMedia, type Language } from "@capella/shared";

type CardImageSource = {
  imagePath?: string | null;
  hoverImagePath?: string | null;
  media?: EntityMedia[] | null;
};

/**
 * The slides a storefront card cycles through: the main image first, the ERP hover image second,
 * then the rest of the gallery in its ERP order. Videos stay on the detail page, and an image
 * that appears twice (the main image is usually also the first gallery item) is shown once.
 */
export function buildCardImages({ imagePath, hoverImagePath, media }: CardImageSource, lang: Language): string[] {
  const gallery = (media ?? [])
    .filter((item) => item.type === "image")
    .map((item) => resolveLocalizedEntityMediaUrl(item, lang));
  const primary = gallery[0] || imagePath || "";
  return Array.from(new Set([primary, hoverImagePath ?? "", ...gallery].filter(Boolean)));
}
