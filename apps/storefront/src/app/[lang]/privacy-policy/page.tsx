import type { Metadata } from "next";
import { StaticPage } from "@/components/pages/static-page";
import { resolveStorefrontLang, resolveStorefrontPageContext } from "@/lib/storefront-page-context";
import { buildStaticPageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return buildStaticPageMetadata(lang, {
    path: "/privacy-policy",
    titleEn: "Privacy Policy",
    titleAr: "سياسة الخصوصية",
    descEn: "How Capella Care collects, uses, stores, and protects your personal information across our website and apps.",
    descAr: "كيف تجمع كابيلا كير معلوماتك الشخصية وتستخدمها وتخزّنها وتحميها عبر موقعنا وتطبيقاتنا."
  });
}

export default async function PrivacyPolicyPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);
  return <StaticPage lang={lang} dict={dict} content={dict.pages.privacy} />;
}
