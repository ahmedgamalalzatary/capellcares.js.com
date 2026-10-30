import type { Metadata } from "next";
import { AttributeProductsPage } from "@/components/products/attribute-products-page";
import { fetchBrands } from "@/lib/api/client";
import { buildAttributeMetadata } from "@/lib/seo";
import { requireStorefrontValue, resolveStorefrontSlugPageContext } from "@/lib/storefront-detail-page";

type Props = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await resolveStorefrontSlugPageContext(params);
  const brand = requireStorefrontValue((await fetchBrands({ lang })).find((item) => item.slug === slug));
  return buildAttributeMetadata(lang, brand, "brands");
}

export default async function BrandPage({ params }: Props) {
  const { lang, slug } = await resolveStorefrontSlugPageContext(params);
  const brand = requireStorefrontValue((await fetchBrands({ lang })).find((item) => item.slug === slug));
  return AttributeProductsPage({ item: brand, lang, kind: "brand", matches: (product) => product.brandId === brand.id });
}
