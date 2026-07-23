import type { Metadata } from "next";
import { StaticPage } from "@/components/pages/static-page";
import { resolveStorefrontLang, resolveStorefrontPageContext } from "@/lib/storefront-page-context";
import { buildStaticPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return buildStaticPageMetadata(lang, {
    path: "/terms-conditions",
    titleEn: "Terms and Conditions",
    titleAr: "الشروط والأحكام",
    descEn: "The terms and conditions governing your use of the Capella Care website, including registration, intellectual property, and liability.",
    descAr: "الشروط والأحكام التي تحكم استخدامك لموقع كابيلا كير، وتشمل التسجيل والملكية الفكرية وحدود المسؤولية."
  });
}

export default async function TermsConditionsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);
  return <StaticPage lang={lang} dict={dict} content={dict.pages.terms} />;
}
