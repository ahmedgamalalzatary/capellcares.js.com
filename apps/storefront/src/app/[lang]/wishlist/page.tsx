import { notFound } from "next/navigation";
import { getDict, languages, type Language } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { WishlistView } from "@/components/wishlist/wishlist-view";

export default async function WishlistPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const dict = getDict(lang as Language);

  return (
    <main className="container">
      <Breadcrumb items={[{ label: dict.common.breadcrumbHome, href: `/${lang}` }, { label: dict.wishlist.title }]} />
      <header className="page-head">
        <span className="eyebrow">{lang === "ar" ? "كل ما تحبينه" : "Saved for later"}</span>
        <h1>{dict.wishlist.title}</h1>
      </header>
      <WishlistView lang={lang as Language} dict={dict} />
    </main>
  );
}
