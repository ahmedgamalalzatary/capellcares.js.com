import { noIndexMetadata } from "@/lib/seo";
import { StorefrontPageShell } from "@/components/layout/storefront-page-shell";
import { PaymobResult } from "@/components/checkout/paymob-result";
import { resolveStorefrontPageContext } from "@/lib/storefront-page-context";

export const metadata = noIndexMetadata();

export default async function PaymentResultPage({ params, searchParams }: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ checkoutId?: string | string[] }>;
}) {
  const { lang, dict } = await resolveStorefrontPageContext(params);
  const returnCheckoutId = (await searchParams).checkoutId;
  return (
    <StorefrontPageShell title={dict.checkout.payment} eyebrow={dict.checkout.eyebrow}
      breadcrumbItems={[{ label: dict.common.breadcrumbHome, href: `/${lang}` },
        { label: dict.checkout.title, href: `/${lang}/checkout` }, { label: dict.checkout.payment }]}>
      <PaymobResult lang={lang} dict={dict}
        returnCheckoutId={typeof returnCheckoutId === "string" ? returnCheckoutId : undefined} />
    </StorefrontPageShell>
  );
}
