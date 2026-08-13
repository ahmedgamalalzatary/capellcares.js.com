import { Breadcrumb } from "@/components/layout/breadcrumb";
import { WishlistView } from "@/components/wishlist/wishlist-view";
import { resolveStorefrontPageContext } from "@/lib/storefront-page-context";

export default async function WishlistPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);

  // Not StorefrontPageShell: this page's head carries the POV toggle beside the
  // title, and that control owns client state, so the header is rendered by
  // WishlistView itself rather than by the shared shell.
  return (
    <main className="container">
      <Breadcrumb
        items={[{ label: dict.common.breadcrumbHome, href: `/${lang}` }, { label: dict.wishlist.title }]}
      />
      <WishlistView lang={lang} dict={dict} />
    </main>
  );
}
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata();
