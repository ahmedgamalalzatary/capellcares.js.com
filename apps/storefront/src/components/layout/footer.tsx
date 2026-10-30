"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Language } from "@capella/shared";
import { SOCIAL_LINKS } from "../../constants/socials";

export function Footer({ lang, dict }: { lang: Language; dict: any }) {
  const year = new Date().getFullYear();
  const isAr = lang === "ar";
  const router = useRouter();
  const pathname = usePathname();

  const switchTo = (next: Language) => {
    if (next === lang) return;
    const rest = pathname.replace(/^\/(ar|en)(?=\/|$)/, "") || "/";
    const search = typeof window !== "undefined" ? window.location.search : "";
    router.push(`/${next}${rest === "/" ? "" : rest}${search}`);
  };

  return (
    <footer dir={isAr ? "rtl" : "ltr"} className="footer-scallop mt-12 text-white">
      <div className="container">
        <div className="grid gap-10 pb-10 pt-12 min-[880px]:grid-cols-[auto_1fr] min-[880px]:gap-20">
          <Link href={`/${lang}/shop`} aria-label={dict.brand} className="justify-self-center min-[880px]:justify-self-start">
            <Image src="/logo-footer.png" alt={dict.brand} width={429} height={604} className="h-40 w-auto min-[880px]:h-52" />
          </Link>

          <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3">
            <FooterCol title={dict.footer.shopTitle}>
              <FooterLink href={`/${lang}/shop`}>{dict.footer.shop}</FooterLink>
              <FooterLink href={`/${lang}/products`}>{dict.footer.allProducts}</FooterLink>
              <FooterLink href={`/${lang}/new`}>{dict.footer.new}</FooterLink>
              <FooterLink href={`/${lang}/bestsellers`}>{dict.footer.bestseller}</FooterLink>
              <FooterLink href={`/${lang}/offers`}>{dict.footer.offers}</FooterLink>
            </FooterCol>

            <FooterCol title={dict.footer.support}>
              <FooterLink href={`/${lang}/about`}>{dict.footer.aboutus}</FooterLink>
              <FooterLink href={`/${lang}/contact`}>{dict.footer.helpcenter}</FooterLink>
              {SOCIAL_LINKS.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {SOCIAL_LINKS.map(({ label, href, path, stroke }) => (
                    <a
                      key={label}
                      href={href}
                      aria-label={dict.footer[label.toLowerCase()]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-(--sunny) hover:text-ink"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        aria-hidden
                        fill={stroke ? "none" : "currentColor"}
                        stroke={stroke ? "currentColor" : "none"}
                        strokeWidth={stroke ? 2 : 0}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={path} />
                      </svg>
                    </a>
                  ))}
                </div>
              )}
            </FooterCol>

            <div className="col-span-2 sm:col-span-1">
              <FooterCol title={dict.footer.legal}>
                <FooterLink href={`/${lang}/terms-of-sale`}>{dict.footer.terms}</FooterLink>
                <FooterLink href={`/${lang}/terms-conditions`}>{dict.footer.promotionTerms}</FooterLink>
                <FooterLink href={`/${lang}/privacy-policy`}>{dict.footer.privacy}</FooterLink>
                <FooterLink href={`/${lang}/returns-refunds`}>{dict.footer.returnsRefunds}</FooterLink>
                <FooterLink href={`/${lang}/shipping-handling`}>{dict.footer.shippingHandling}</FooterLink>
              </FooterCol>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 border-t border-white/20 pb-24 pt-5 text-center min-[880px]:flex-row min-[880px]:justify-between">
          <p className="m-0 font-bold">{dict.footer.paymentMethods}</p>
          <p className="m-0 text-sm text-white/70">
            © {year} {dict.footer.creator}. {dict.footer.rights}
          </p>
          <div className="flex items-center rounded-full bg-white/10 p-1">
            {(["en", "ar"] as const).map((code) => {
              const active = lang === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => switchTo(code)}
                  aria-pressed={active}
                  className={`min-h-9 rounded-full px-4 text-sm font-bold transition-colors ${active ? "bg-(--sunny) text-ink" : "text-white hover:text-(--sunny)"}`}
                >
                  {dict.langSwitch[code]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 mt-0 text-lg font-extrabold text-(--sunny)">{title}</h2>
      <div className="grid gap-1">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="block py-1 font-semibold leading-snug text-white/85 transition-colors hover:text-(--sunny)" href={href}>
      {children}
    </Link>
  );
}
