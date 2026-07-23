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
    descEn: "Discover Capella Care — curated body, skin, and hair care, makeup, fragrances, and home scents crafted with high-quality, science-backed ingredients.",
    descAr: "تعرّف على كابيلا كير — منتجات مختارة للعناية بالجسم والبشرة والشعر والمكياج والعطور بمكونات عالية الجودة ومدعومة علميًا."
  });
}

export default async function AboutPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);
  return <StaticPage lang={lang} dict={dict} content={dict.pages.about} />;
}
