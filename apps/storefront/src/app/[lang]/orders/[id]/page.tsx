import { notFound } from "next/navigation";
import { getDict } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";

export default async function OrderPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { id } = await params;
  const lang = await resolveStorefrontLang(params);
  const orderId = Number.parseInt(id, 10);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();
  const dict = getDict(lang);

  return (
    <main className="container">
      <Breadcrumb items={[{ label: dict.common.breadcrumbHome, href: `/${lang}` }, { label: dict.orders.title, href: `/${lang}/orders` }, { label: id }]} />
      <OrderDetailView lang={lang} dict={dict} orderId={orderId} />
    </main>
  );
}
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata();
