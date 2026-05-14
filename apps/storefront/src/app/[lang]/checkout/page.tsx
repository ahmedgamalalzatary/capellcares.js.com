import { notFound } from "next/navigation";
import { getDict, languages, type Language } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CheckoutView } from "@/components/checkout/checkout-view";

export default async function CheckoutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const dict = getDict(lang as Language);

  return (
    <main className="container">
      <Breadcrumb items={[
        { label: dict.common.breadcrumbHome, href: `/${lang}` },
        { label: dict.cart.title, href: `/${lang}/cart` },
        { label: dict.checkout.title }
      ]} />
      <header className="page-head">
        <span className="eyebrow">{lang === "ar" ? "آخر خطوة" : "Almost there"}</span>
        <h1>{dict.checkout.title}</h1>
      </header>
      <CheckoutView lang={lang as Language} dict={dict} />
    </main>
  );
}
