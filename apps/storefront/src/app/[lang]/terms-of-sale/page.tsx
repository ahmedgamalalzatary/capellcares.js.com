import type { Metadata } from "next";
import { StaticPage } from "@/components/pages/static-page";
import { resolveStorefrontLang, resolveStorefrontPageContext } from "@/lib/storefront-page-context";
import { buildStaticPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return buildStaticPageMetadata(lang, {
    path: "/terms-of-sale",
    titleEn: "Terms and Conditions of Sale",
    titleAr: "شروط وأحكام الشراء",
    descEn: "The legal terms under which Capella Care sells products online, including pricing, ordering, payment, delivery, returns, and offers.",
    descAr: "الشروط القانونية التي تبيع بموجبها كابيلا كير منتجاتها عبر الإنترنت، وتشمل الأسعار والطلب والدفع والتوصيل والإرجاع والعروض."
  });
}

export default async function TermsOfSalePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);
  return <StaticPage lang={lang} dict={dict} content={dict.pages.termsSale} />;
}
