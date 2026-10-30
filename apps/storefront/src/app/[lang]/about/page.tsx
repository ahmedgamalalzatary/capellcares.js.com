import type { Metadata } from "next";
import { StaticPage } from "@/components/pages/static-page";
import { resolveStorefrontLang, resolveStorefrontPageContext } from "@/lib/storefront-page-context";
import { buildStaticPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return buildStaticPageMetadata(lang, {
    path: "/about",
    titleEn: "About Us",
    titleAr: "نبذة عنا",
    descEn: "Discover Falta Toy, a toy shop for every age with the brands and characters kids love.",
    descAr: "تعرّف على فلتة توي، متجر ألعاب لكل الأعمار من الماركات والشخصيات التي يحبها الأطفال."
  });
}

export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);
  return <StaticPage lang={lang} dict={dict} content={dict.pages.about} />;
}
