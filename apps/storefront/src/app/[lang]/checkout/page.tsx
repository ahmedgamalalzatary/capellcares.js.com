import { notFound } from "next/navigation";
import { StorefrontPageShell } from "@/components/layout/storefront-page-shell";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { resolveStorefrontPageContext } from "@/lib/storefront-page-context";

export default async function CheckoutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);

  return (
    <StorefrontPageShell
      breadcrumbItems={[
        { label: dict.common.breadcrumbHome, href: `/${lang}` },
        { label: dict.cart.title, href: `/${lang}/cart` },
        { label: dict.checkout.title }
      ]}
      eyebrow={lang === "ar" ? "آخر خطوة" : "Almost there"}
      title={dict.checkout.title}
    >
      <CheckoutView lang={lang} dict={dict} />
    </StorefrontPageShell>
  );
}
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata();
