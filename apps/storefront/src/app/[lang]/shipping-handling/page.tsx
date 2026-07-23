import type { Metadata } from "next";
import { StaticPage } from "@/components/pages/static-page";
import { resolveStorefrontLang, resolveStorefrontPageContext } from "@/lib/storefront-page-context";
import { buildStaticPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return buildStaticPageMetadata(lang, {
    path: "/shipping-handling",
    titleEn: "Shipping and Handling",
    titleAr: "الشحن والتوصيل",
    descEn: "Capella Care shipping and handling information — delivery times, fees, tracking, and customs duties for orders worldwide.",
    descAr: "معلومات الشحن والتوصيل من كابيلا كير — أوقات التوصيل والرسوم والتتبع والرسوم الجمركية للطلبات حول العالم."
  });
}

export default async function ShippingHandlingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);
  return <StaticPage lang={lang} dict={dict} content={dict.pages.shipping} />;
}
