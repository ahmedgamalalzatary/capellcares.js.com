import { notFound } from "next/navigation";
import { getDict } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { resolveStorefrontLang } from "@/lib/storefront-page-context";

export default async function OrderPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { id } = await params;
  const lang = await resolveStorefrontLang(params);
  const orderId = Number(id);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(orderId) || orderId > 2_147_483_647) notFound();
  const dict = getDict(lang);

  return (
    <main className="container">
      <Breadcrumb items={[{ label: dict.common.breadcrumbHome, href: `/${lang}/shop` }, { label: dict.orders.title, href: `/${lang}/orders` }, { label: id }]} />
      <OrderDetailView lang={lang} dict={dict} orderId={orderId} />
    </main>
  );
}
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata();
