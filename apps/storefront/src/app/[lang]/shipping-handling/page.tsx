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
    descEn: "Falta Toy delivery information: free delivery within Egypt, delivery times, and cash on delivery.",
    descAr: "معلومات التوصيل من فلتة توي: توصيل مجاني داخل مصر وأوقات التوصيل والدفع عند الاستلام."
  });
}

export default async function ShippingHandlingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);
  return <StaticPage lang={lang} dict={dict} content={dict.pages.shipping} />;
}
