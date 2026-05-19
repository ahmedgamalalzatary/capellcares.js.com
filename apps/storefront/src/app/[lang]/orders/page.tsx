import { notFound } from "next/navigation";
import { getDict, languages, type Language } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { OrdersView } from "@/components/orders/orders-view";

export default async function OrdersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const dict = getDict(lang as Language);

  return (
    <main className="container">
      <Breadcrumb items={[{ label: dict.common.breadcrumbHome, href: `/${lang}` }, { label: dict.orders.title }]} />
      <header className="page-head">
        <span className="eyebrow">{dict.orders.title}</span>
        <h1>{dict.orders.title}</h1>
      </header>
      <OrdersView lang={lang as Language} dict={dict} />
    </main>
  );
}
