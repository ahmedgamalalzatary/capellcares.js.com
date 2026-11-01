"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { SocialIcon } from "./social-icon";
import { SOCIAL_LINKS, WHATSAPP_URL } from "../../constants/socials";

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
        <div className="grid gap-10 pb-10 pt-12 lg:grid-cols-[auto_1fr] lg:gap-16">
          <Link href={`/${lang}/shop`} aria-label={dict.brand} className="justify-self-center lg:justify-self-start">
            <Image src="/logo-footer.png" alt={dict.brand} width={429} height={604} className="h-40 w-auto lg:h-52" />
          </Link>

          <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-4 lg:border-s lg:border-white/20 lg:ps-12">
            <FooterCol title={dict.footer.shopTitle}>
              <FooterLink href={`/${lang}/shop#categories`}>{dict.footer.categories}</FooterLink>
              <FooterLink href={`/${lang}/shop#brands`}>{dict.footer.brands}</FooterLink>
              <FooterLink href={`/${lang}/new`}>{dict.footer.new}</FooterLink>
              <FooterLink href={`/${lang}/bestsellers`}>{dict.footer.bestseller}</FooterLink>
              <FooterLink href={`/${lang}/offers`}>{dict.footer.offers}</FooterLink>
              <FooterLink href={`/${lang}/about`}>{dict.footer.aboutus}</FooterLink>
            </FooterCol>

            <FooterCol title={dict.footer.social}>
              {SOCIAL_LINKS.map(({ label, href, path, stroke }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 py-1 font-semibold leading-snug text-white/85 transition-colors hover:text-(--sunny)"
                >
                  <SocialIcon path={path} stroke={stroke} className="h-4 w-4 shrink-0" />
                  <span>{dict.footer[label.toLowerCase()]}</span>
                </a>
              ))}
            </FooterCol>

            <FooterCol title={dict.footer.support}>
              <FooterLink href={`/${lang}/contact`}>{dict.footer.helpcenter}</FooterLink>
              <a
                className="block py-1 font-semibold leading-snug text-white/85 transition-colors hover:text-(--sunny)"
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {dict.footer.connectWhatsapp}
              </a>
            </FooterCol>

            <FooterCol title={dict.footer.legal}>
              <FooterLink href={`/${lang}/terms-of-sale`}>{dict.footer.terms}</FooterLink>
              <FooterLink href={`/${lang}/terms-conditions`}>{dict.footer.promotionTerms}</FooterLink>
              <FooterLink href={`/${lang}/privacy-policy`}>{dict.footer.privacy}</FooterLink>
              <FooterLink href={`/${lang}/returns-refunds`}>{dict.footer.returnsRefunds}</FooterLink>
              <FooterLink href={`/${lang}/shipping-handling`}>{dict.footer.shippingHandling}</FooterLink>
            </FooterCol>
          </div>
        </div>

        {/* [display:grid], not grid: the global .grid class carries its own gap. Equal outer columns keep the badges in the true middle. */}
        <div className="[display:grid] items-center justify-items-center gap-6 border-t border-white/20 py-6 min-[880px]:grid-cols-[1fr_auto_1fr]">
          <div
            role="img"
            aria-label={dict.footer.paymentMethods}
            title={dict.footer.paymentMethods}
            className="flex h-14 w-28 items-center justify-center overflow-hidden text-(--sunny) min-[880px]:justify-self-start"
          >
            <Icon.CashOnDelivery className="h-24 w-24" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <StoreBadge href={`/${lang}/get-app`} top={dict.footer.downloadOn} bottom={dict.footer.appStore} icon={<Icon.Apple className="h-6 w-6" />} />
            <StoreBadge href={`/${lang}/get-app`} top={dict.footer.getItOn} bottom={dict.footer.googlePlay} icon={<Icon.GooglePlay className="h-5 w-5" />} />
          </div>

          <div className="flex items-center rounded-full bg-white/10 p-1 min-[880px]:justify-self-end">
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

        <p className="m-0 border-t border-white/20 pb-24 pt-5 text-center text-sm text-white/70">
          © {year} {dict.footer.creator}. {dict.footer.rights}
        </p>
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

/* Leads to the "coming soon" page until the apps ship. */
function StoreBadge({ href, top, bottom, icon }: { href: string; top: string; bottom: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="flex h-12 items-center gap-2.5 rounded-2xl bg-white/10 px-4 text-white transition-colors hover:bg-white/20">
      <span className="shrink-0">{icon}</span>
      <span className="flex flex-col text-start leading-none">
        <span className="text-[0.6rem] tracking-wide opacity-80">{top}</span>
        <span className="text-sm font-semibold leading-tight">{bottom}</span>
      </span>
    </Link>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="block py-1 font-semibold leading-snug text-white/85 transition-colors hover:text-(--sunny)" href={href}>
      {children}
    </Link>
  );
}
