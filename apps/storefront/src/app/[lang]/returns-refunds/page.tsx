import type { Metadata } from "next";
import { StaticPage } from "@/components/pages/static-page";
import { resolveStorefrontLang, resolveStorefrontPageContext } from "@/lib/storefront-page-context";
import { buildStaticPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return buildStaticPageMetadata(lang, {
    path: "/returns-refunds",
    titleEn: "Returns & Refunds",
    titleAr: "الإرجاع واسترداد الأموال",
    descEn: "Capella Care's return, exchange, and refund policy for online orders, including conditions, timelines, and eligibility.",
    descAr: "سياسة كابيلا كير للإرجاع والاستبدال واسترداد الأموال للطلبات عبر الإنترنت، وتشمل الشروط والمواعيد والأهلية."
  });
}

export default async function ReturnsRefundsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);
  return <StaticPage lang={lang} dict={dict} content={dict.pages.returns} />;
}
