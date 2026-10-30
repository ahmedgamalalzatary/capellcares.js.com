import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/coming-soon";
import { resolveStorefrontLang, resolveStorefrontPageContext } from "@/lib/storefront-page-context";
import { buildStaticPageMetadata, noIndexMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return {
    ...buildStaticPageMetadata(lang, {
      path: "/get-app",
      titleEn: "Get the App",
      titleAr: "حمّل التطبيق",
      descEn: "The Falta Toy app for iPhone and Android is coming soon.",
      descAr: "تطبيق فلتة توي لأجهزة آيفون وأندرويد قريبًا."
    }),
    // A placeholder until the apps ship; nothing here for search engines yet.
    ...noIndexMetadata()
  };
}

/** Where the footer's App Store and Google Play badges lead until the apps are published. */
export default async function GetAppPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);
  return (
    <div className="container">
      <ComingSoon
        lang={lang}
        title={dict.appComingSoon.title}
        description={dict.appComingSoon.desc}
        href={`/${lang}/shop`}
        cta={dict.appComingSoon.backToShop}
      />
    </div>
  );
}
