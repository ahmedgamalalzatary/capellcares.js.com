import { StorefrontPageShell } from "@/components/layout/storefront-page-shell";
import { CartView } from "@/components/cart/cart-view";
import { resolveStorefrontPageContext } from "@/lib/storefront-page-context";

export default async function CartPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);

  return (
    <StorefrontPageShell
      breadcrumbItems={[{ label: dict.common.breadcrumbHome, href: `/${lang}` }, { label: dict.cart.title }]}
      title={dict.cart.title}
    >
      <CartView lang={lang} dict={dict} />
    </StorefrontPageShell>
  );
}
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata();
