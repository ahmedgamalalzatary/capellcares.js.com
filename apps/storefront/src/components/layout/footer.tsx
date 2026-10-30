"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Language } from "@capella/shared";
import { SOCIAL_LINKS } from "../../constants/socials";
import { Icon } from "@/components/ui/icons";

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
    <footer dir={isAr ? "rtl" : "ltr"} className="footer-burst mt-6 text-ink">
      <div className="container">
        <div className="flex justify-center pt-8 pb-10">
          <Image src="/falta-logo.png" alt={dict.brand} width={371} height={479} className="h-32 w-auto sm:h-40" />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-10 pb-12 sm:grid-cols-4">
          <FooterCol title={dict.footer.shopTitle}>
            <FooterLink href={`/${lang}/shop`}>{dict.footer.shop}</FooterLink>
            <FooterLink href={`/${lang}/products`}>{dict.footer.allProducts}</FooterLink>
            <FooterLink href={`/${lang}/new`}>{dict.footer.new}</FooterLink>
            <FooterLink href={`/${lang}/bestsellers`}>{dict.footer.bestseller}</FooterLink>
            <FooterLink href={`/${lang}/offers`}>{dict.footer.offers}</FooterLink>
            <FooterLink href={`/${lang}/collections`}>{dict.footer.collections}</FooterLink>
          </FooterCol>

          <FooterCol title={dict.footer.support}>
            <FooterLink href={`/${lang}/about`}>{dict.footer.aboutus}</FooterLink>
            <FooterLink href={`/${lang}/contact`}>{dict.footer.helpcenter}</FooterLink>
          </FooterCol>

          <FooterCol title={dict.footer.legal}>
            <FooterLink href={`/${lang}/terms-of-sale`}>{dict.footer.terms}</FooterLink>
            <FooterLink href={`/${lang}/terms-conditions`}>{dict.footer.promotionTerms}</FooterLink>
            <FooterLink href={`/${lang}/privacy-policy`}>{dict.footer.privacy}</FooterLink>
            <FooterLink href={`/${lang}/returns-refunds`}>{dict.footer.returnsRefunds}</FooterLink>
            <FooterLink href={`/${lang}/shipping-handling`}>{dict.footer.shippingHandling}</FooterLink>
          </FooterCol>

          {SOCIAL_LINKS.length > 0 && (
                    <FooterCol title={dict.footer.social}>
            {SOCIAL_LINKS.map(({ label, href, path, stroke }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 font-semibold text-(--ink-2) transition-colors hover:text-(--violet)"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0"
                  aria-hidden
                  fill={stroke ? "none" : "currentColor"}
                  stroke={stroke ? "currentColor" : "none"}
                  strokeWidth={stroke ? 2 : 0}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={path} />
                </svg>
                <span>{dict.footer[label.toLowerCase()]}</span>
              </a>
            ))}
          </FooterCol>
          )}
        </div>

        <div className="flex flex-col items-center justify-between gap-6 border-t-2 border-(--hairline) py-6 sm:flex-row">
          <div className="flex items-center gap-2 font-bold">
            <Icon.CashOnDelivery className="h-10 w-auto" />
            <span>{dict.footer.paymentMethods}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <StoreBadge
              href={`/${lang}/get-app`}
              top={dict.footer.downloadOn}
              bottom={dict.footer.appStore}
              icon={<Icon.Apple className="h-6 w-6" />}
            />
            <StoreBadge
              href={`/${lang}/get-app`}
              top={dict.footer.getItOn}
              bottom={dict.footer.googlePlay}
              icon={<Icon.GooglePlay className="h-5 w-5" />}
            />
          </div>
          <div className="flex items-center rounded-full bg-surface p-1 shadow-[inset_0_0_0_2px_var(--hairline)]">
            {(["en", "ar"] as const).map((code) => {
              const active = lang === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => switchTo(code)}
                  aria-pressed={active}
                  className={`rounded-full px-4 py-1 text-sm font-bold transition-colors ${active ? "bg-(--violet) text-white" : "text-(--ink-2) hover:text-(--violet)"}`}
                >
                  {dict.langSwitch[code]}
                </button>
              );
            })}
          </div>
        </div>

        <p className="m-0 pb-6 text-center text-sm text-(--ink-3)">
          © {year} {dict.footer.creator}. {dict.footer.rights}
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-4 mt-0 text-lg font-extrabold text-ink">{title}</h2>
      <div className="grid gap-2.5">{children}</div>
    </div>
  );
}

function FooterLink({
  href,
  as,
  external,
  children,
}: {
  href?: string;
  as?: "span";
  external?: boolean;
  children: React.ReactNode;
}) {
  const cls = "block font-semibold leading-snug text-(--ink-2) transition-colors hover:text-(--violet) cursor-pointer";
  if (as === "span" || href === undefined)
    return <span className={cls}>{children}</span>;
  if (external)
    return <a className={cls} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
  // Empty href: render an anchor placeholder until the destination is wired up.
  if (href === "")
    return <a className={cls} href="" onClick={(e) => e.preventDefault()}>{children}</a>;
  return (
    <Link className={cls} href={href}>
      {children}
    </Link>
  );
}

/* App-store style dark pill with a two-line label. Leads to the "coming soon" page until the apps ship. */
function StoreBadge({
  href,
  top,
  bottom,
  icon,
}: {
  href: string;
  top: string;
  bottom: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex h-12 items-center gap-2.5 rounded-2xl bg-ink px-4 text-white transition-opacity duration-200 hover:opacity-85 cursor-pointer"
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex flex-col leading-none">
        <span className="text-[0.6rem] tracking-wide opacity-80">{top}</span>
        <span className="text-sm font-semibold leading-tight">{bottom}</span>
      </span>
    </Link>
  );
}
