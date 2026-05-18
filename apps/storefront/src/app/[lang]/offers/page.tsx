import { notFound } from "next/navigation";
import Link from "next/link";
import { getDict, formatPrice, languages, pickLang, type Language } from "@capella/shared";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { OfferIllustration } from "@/components/ui/offer-illustration";
import { fetchOffers } from "@/lib/api/client";
import styles from "./offers.module.css";

export default async function OffersPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!languages.includes(lang as Language)) notFound();
  const dict = getDict(lang as Language);
  const offers = await fetchOffers({ lang });

  return (
    <main className="container">
      <Breadcrumb
        items={[
          { label: dict.common.breadcrumbHome, href: `/${lang}` },
          { label: dict.offers.title }
        ]}
      />
      <header className="page-head">
        <span className="eyebrow">{lang === "ar" ? "العروض الحصرية" : "Exclusive bundles"}</span>
        <h1>{dict.offers.title}</h1>
        <p className="muted" style={{ maxWidth: "60ch" }}>
          {lang === "ar"
            ? "باقات مختارة بعناية وبسعر باقة موفر، لتأخذي روتينك إلى المستوى التالي."
            : "Carefully curated bundles at a bundle price — your routine, upgraded."}
        </p>
      </header>

      {offers.length === 0 ? (
        <p className="muted">{dict.offers.listEmpty}</p>
      ) : (
        <div className="grid grid--offers" style={{ paddingBottom: 80 }}>
          {offers.map((o) => {
            const savings = o.originalTotal - o.price;
            return (
              <Link key={o.id} href={`/${lang}/offers/${o.slug}`} className={styles.card}>
                <div className={styles.media}>
                  <OfferIllustration offer={o} className={styles.thumb} />
                  <span className="badge badge--offer" style={{ position: "absolute", top: 14, insetInlineStart: 14 }}>
                    {dict.offers.badge}
                  </span>
                </div>
                <div className={styles.body}>
                  <h3 className={styles.name}>{pickLang(o.name, lang as Language)}</h3>
                  <p className="muted" style={{ fontSize: 13 }}>{pickLang(o.description, lang as Language)}</p>
                  <div className={styles.priceRow}>
                    <span className={styles.price}>{formatPrice(o.price, lang as Language)}</span>
                    {savings > 0 && (
                      <>
                        <span className={styles.strike}>{formatPrice(o.originalTotal, lang as Language)}</span>
                        <span className="chip chip--accent">{dict.offers.save.replace("{amount}", formatPrice(savings, lang as Language))}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
