import { notFound } from "next/navigation";
import { getDict, languages, type Language } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CartView } from "@/components/cart/cart-view";

export default async function CartPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const dict = getDict(lang as Language);

  return (
    <main className="container">
      <Breadcrumb items={[{ label: dict.common.breadcrumbHome, href: `/${lang}` }, { label: dict.cart.title }]} />
      <header className="page-head">
        <span className="eyebrow">{lang === "ar" ? "خطوة قبل الدفع" : "One step from checkout"}</span>
        <h1>{dict.cart.title}</h1>
      </header>
      <CartView lang={lang as Language} dict={dict} />
    </main>
  );
}
