import Link from "next/link";
import type { Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import styles from "./footer.module.css";

export function Footer({ lang, dict }: { lang: Language; dict: any }) {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.grid}>
          <div className={styles.brandCol}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <Icon.Logo size={36} />
              <span className="display" style={{ fontSize: 22 }}>{dict.brand}</span>
            </div>
            <p className={styles.tag}>{dict.tagline}</p>
            <form className={styles.newsletter} onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder={lang === "ar" ? "بريدك الإلكتروني" : "Email address"}
                className={styles.newsletterInput}
                aria-label={lang === "ar" ? "بريدك الإلكتروني" : "Email address"}
              />
              <button className="btn btn--primary btn--sm" type="submit">
                {lang === "ar" ? "اشترك" : "Subscribe"}
              </button>
            </form>
          </div>
          <div>
            <div className={styles.colHead}>{lang === "ar" ? "تسوقي" : "Shop"}</div>
            <Link className={styles.link} href={`/${lang}/products`}>{dict.nav.products}</Link>
            <Link className={styles.link} href={`/${lang}/offers`}>{dict.nav.offers}</Link>
            <Link className={styles.link} href={`/${lang}/category/skin-care`}>{lang === "ar" ? "العناية بالبشرة" : "Skin Care"}</Link>
            <Link className={styles.link} href={`/${lang}/category/hair-care`}>{lang === "ar" ? "العناية بالشعر" : "Hair Care"}</Link>
            <Link className={styles.link} href={`/${lang}/category/fragrances`}>{lang === "ar" ? "العطور" : "Fragrances"}</Link>
          </div>
          <div>
            <div className={styles.colHead}>{lang === "ar" ? "كابيلا" : "Capella"}</div>
            <span className={styles.link}>{lang === "ar" ? "قصتنا" : "Our story"}</span>
            <span className={styles.link}>{lang === "ar" ? "الفروع" : "Branches"}</span>
            <span className={styles.link}>{lang === "ar" ? "تواصلي معنا" : "Contact"}</span>
          </div>
          <div>
            <div className={styles.colHead}>{lang === "ar" ? "الحساب" : "Account"}</div>
            <Link className={styles.link} href={`/${lang}/login`}>{dict.nav.login}</Link>
            <Link className={styles.link} href={`/${lang}/signup`}>{dict.nav.signup}</Link>
            <Link className={styles.link} href={`/${lang}/cart`}>{dict.nav.cart}</Link>
          </div>
        </div>
        <div className={styles.bottom}>
          <span>© {year} {dict.brand}. {lang === "ar" ? "كل الحقوق محفوظة." : "All rights reserved."}</span>
          <span style={{ color: "var(--ink-3)", fontSize: 12 }}>
            {lang === "ar" ? "العملة: جنيه مصري" : "Currency: EGP"}
          </span>
        </div>
      </div>
    </footer>
  );
}
