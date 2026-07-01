import type { Metadata } from "next";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ContactView } from "@/components/contact/contact-view";
import { resolveStorefrontLang, resolveStorefrontPageContext } from "@/lib/storefront-page-context";
import { buildContactMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = await resolveStorefrontLang(params);
  return buildContactMetadata(lang);
}

export default async function ContactPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang, dict } = await resolveStorefrontPageContext(params);

  return (
    <main className="container">
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.contact.title }
        ]}
      />
      <div className="mx-auto w-full max-w-xl ">
        <header className="page-head">
          <h1>{dict.contact.title}</h1>
        </header>
        <p className="mb-10 max-w-[52ch] text-base leading-[1.7] text-(--ink-2)">
          {dict.contact.intro}
        </p>
        <ContactView lang={lang} dict={dict} />
      </div>
    </main>
  );
}
