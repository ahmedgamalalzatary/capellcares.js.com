import { notFound } from "next/navigation";
import { getDict, languages, type Language } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { OrderDetailView } from "@/components/orders/order-detail-view";

export default async function OrderPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const orderId = Number.parseInt(id, 10);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();
  const dict = getDict(lang as Language);

  return (
    <main className="container">
      <Breadcrumb items={[{ label: dict.common.breadcrumbHome, href: `/${lang}` }, { label: dict.orders.title, href: `/${lang}/orders` }, { label: id }]} />
      <OrderDetailView lang={lang as Language} dict={dict} orderId={orderId} />
    </main>
  );
}
