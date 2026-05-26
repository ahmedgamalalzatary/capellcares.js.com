import { notFound } from "next/navigation";
import { StorefrontPageShell } from "@/components/layout/storefront-page-shell";
import { WishlistView } from "@/components/wishlist/wishlist-view";
import { resolveStorefrontPageContext } from "@/lib/storefront-page-context";

export default async function WishlistPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);

  return (
    <StorefrontPageShell
      breadcrumbItems={[{ label: dict.common.breadcrumbHome, href: `/${lang}` }, { label: dict.wishlist.title }]}
      eyebrow={lang === "ar" ? "كل ما تحبينه" : "Saved for later"}
      title={dict.wishlist.title}
    >
      <WishlistView lang={lang} dict={dict} />
    </StorefrontPageShell>
  );
}
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata();
