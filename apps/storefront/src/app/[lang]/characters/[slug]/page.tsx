import type { Metadata } from "next";
import { AttributeProductsPage } from "@/components/products/attribute-products-page";
import { fetchCharacters } from "@/lib/api/client";
import { buildAttributeMetadata } from "@/lib/seo";
import { requireStorefrontValue, resolveStorefrontSlugPageContext } from "@/lib/storefront-detail-page";

type Props = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await resolveStorefrontSlugPageContext(params);
  const character = requireStorefrontValue((await fetchCharacters({ lang })).find((item) => item.slug === slug));
  return buildAttributeMetadata(lang, character, "characters");
}

export default async function CharacterPage({ params }: Props) {
  const { lang, slug } = await resolveStorefrontSlugPageContext(params);
  const character = requireStorefrontValue((await fetchCharacters({ lang })).find((item) => item.slug === slug));
  return (
    AttributeProductsPage({ item: character, lang, kind: "character", matches: (product) => Boolean(product.characterIds?.includes(character.id)) })
  );
}
