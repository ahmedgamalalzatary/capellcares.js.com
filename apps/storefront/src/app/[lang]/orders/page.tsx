import { notFound } from "next/navigation";
import { StorefrontPageShell } from "@/components/layout/storefront-page-shell";
import { OrdersView } from "@/components/orders/orders-view";
import { resolveStorefrontPageContext } from "@/lib/storefront-page-context";

export default async function OrdersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);

  return (
    <StorefrontPageShell
      breadcrumbItems={[{ label: dict.common.breadcrumbHome, href: `/${lang}` }, { label: dict.orders.title }]}
      eyebrow={dict.orders.title}
      title={dict.orders.title}
    >
      <OrdersView lang={lang} dict={dict} />
    </StorefrontPageShell>
  );
}
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata();
