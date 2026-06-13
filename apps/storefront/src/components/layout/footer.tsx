"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Language } from "@capella/shared";
import { HEADER_SOCIAL_LINKS } from "../../constants/socials";
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

  const brandRef = useRef<HTMLDivElement>(null);
  const [brandInView, setBrandInView] = useState(false);

  useEffect(() => {
    const el = brandRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setBrandInView(entry.isIntersecting),
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <footer className="container">
      <div
      dir={isAr ? "rtl" : "ltr"}
      style={{ background: "var(--footer-bg)" }}
      className="relative rounded-xl mt-24 mb-10 overflow-hidden pb-0 text-ink"
    >
      {/* Noise grain overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px 256px",
        }}
      />

      {/* Hero brand mark — oversized rounded lowercase wordmark */}
      <div className="relative px-2 py-10 text-center sm:py-20">
        <div
          ref={brandRef}
          style={{
            transform: brandInView ? "scale(1)" : "scale(1.04)",
            transition: "transform 700ms var(--ease-out-expo)"
          }}
        >
          <span dir="ltr" aria-label={dict.brand} className="brand-wordmark block w-full text-center">
            Capella Care
          </span>
        </div>
      </div>

      {/* Main content grid */}
      <div
        className="relative border-t"
        style={{ borderColor: "color-mix(in oklch, var(--ink) 12%, transparent)" }}
      >
        <div className="container grid grid-cols-1 gap-12 py-16 lg:grid-cols-[1.1fr_2fr]">

          {/* Newsletter / intro */}
          <div className="border-b border-[color-mix(in_oklch,var(--ink)_12%,transparent)] pb-12 lg:max-w-md lg:border-b-0 lg:pb-0">
            <p className="text-xl leading-snug text-ink font-(family-name:--font-display)">
              {dict.footer.newsletterTitle}
            </p>
            <p className="mt-5 text-base leading-[1.75] text-ink/55">
              {dict.footer.newsletterSubtitle}
            </p>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="mt-7 mx-auto flex  items-center overflow-hidden rounded-(--radius) border border-[color-mix(in_oklch,var(--ink)_18%,transparent)] bg-surface sm:w-full"
            >
              <input
                type="email"
                required
                placeholder={dict.footer.emailPlaceholder}
                aria-label={dict.footer.emailPlaceholder}
                className="min-w-0 flex-1 bg-transparent px-5 py-3.5 text-md font-bold text-ink outline-none placeholder:text-ink/40"
              />
              <button
                type="submit"
                className={`shrink-0 border-s border-[color-mix(in_oklch,var(--ink)_18%,transparent)] px-5 py-3.5 text-xs font-semibold tracking-[0.18em] text-ink transition-colors ${isAr ? "" : "uppercase"}`}
              >
                {dict.footer.subscribe}
              </button>
            </form>

            <p className="mt-4 text-md leading-relaxed text-ink">
              {dict.footer.privacyNote}
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-1 justify-items-center text-center gap-y-8 min-[380px]:grid-cols-2 min-[380px]:justify-items-start min-[380px]:text-start min-[380px]:gap-x-4 min-[380px]:gap-y-10 sm:grid-cols-4 sm:gap-x-8 sm:gap-y-12 lg:border-s lg:border-[color-mix(in_oklch,var(--ink)_12%,transparent)] lg:ps-12">
            <FooterCol title={dict.footer.navigate} isAr={isAr}>
              <FooterLink href={`/${lang}/shop`}>{dict.nav.products}</FooterLink>
              <FooterLink href={`/${lang}/new`}>{dict.nav.new}</FooterLink>
              <FooterLink href={`/${lang}/bestsellers`}>{dict.nav.bestsellers}</FooterLink>
              <FooterLink href={`/${lang}/offers`}>{dict.footer.offers}</FooterLink>
              <FooterLink href={`/${lang}/collections`}>{dict.footer.collections}</FooterLink>
                <FooterLink href={`/${lang}/about`}>{dict.footer.about}</FooterLink> {/* not working yet */}
            </FooterCol>

            <FooterCol title={dict.footer.social} isAr={isAr}>
              {HEADER_SOCIAL_LINKS.map(({ label, href, path, stroke }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center min-[380px]:justify-start hover:underline gap-2 font-bold text-sm tracking-wide text-ink/80 transition-colors duration-200 hover:text-ink"
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

            <FooterCol title={dict.footer.support} isAr={isAr}>
                <FooterLink href={`/${lang}/contact`}>{dict.footer.helpcenter}</FooterLink> {/* not working yet */}
              <FooterLink href="https://wa.me/201034668590" external>{dict.footer.connectWhatsapp}</FooterLink>
              <FooterLink href="https://maps.app.goo.gl/e7yyegwreC3DfEMA7?g_st=iw" external>{dict.footer.storeLocator}</FooterLink>
            </FooterCol>
            <FooterCol title={dict.footer.legal} isAr={isAr}>
              <FooterLink href="">{dict.footer.terms}</FooterLink>
              <FooterLink href="">{dict.footer.promotionTerms}</FooterLink>
              <FooterLink href="">{dict.footer.privacy}</FooterLink>
              <FooterLink href="">{dict.footer.returnsRefunds}</FooterLink>
              <FooterLink href="">{dict.footer.shippingHandling}</FooterLink>
            </FooterCol>
          </div>
        </div>
      </div>

      {/* Payment methods + app download */}
      <div
        className="relative border-t"
        style={{ borderColor: "color-mix(in oklch, var(--ink) 12%, transparent)" }}
      >
        <div className="container flex flex-col gap-10 py-10 sm:flex-row sm:items-start sm:justify-between">
          {/* Payment methods */}
          <div>
            <div className={`mb-4 text-xs tracking-[0.3em] text-ink/80 ${isAr ? "" : "uppercase"}`}>
              {dict.footer.paymentMethods}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PayChip label="Visa">
                <Icon.Visa className="h-3.5 w-auto" />
              </PayChip>
              <PayChip label="Mastercard">
                <Icon.Mastercard className="h-5 w-auto" />
              </PayChip>
              <PayChip label="Paymob">
                <Icon.Paymob className="h-3 w-auto" />
              </PayChip>
              <PayChip label="Cash on Delivery">
                <Image src="/cash.svg" alt="Cash on Delivery" width={48} height={48} className="h-7 w-auto" />
              </PayChip>
            </div>
          </div>

          {/* App download */}
          <div>
            <div className={`mb-4 text-xs tracking-[0.3em] text-ink/80 ${isAr ? "" : "uppercase"}`}>
              {dict.footer.getApp}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StoreBadge
                href=""
                top={dict.footer.downloadOn}
                bottom={dict.footer.appStore}
                icon={<Icon.Apple className="h-6 w-6" />}
              />
              <StoreBadge
                href=""
                top={dict.footer.getItOn}
                bottom={dict.footer.googlePlay}
                icon={<Icon.GooglePlay className="h-5 w-5" />}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="relative"
        style={{ borderTop: "1px solid color-mix(in oklch, var(--ink) 12%, transparent)" }}
      >
        <div className="container flex flex-col items-center justify-between gap-4 py-6 text-xs tracking-[0.12em] text-ink/35 sm:flex-row">
          <span className={isAr ? "" : "uppercase"}>
            © {year} {dict.footer.creator}.{" "}
            {dict.footer.rights}
          </span>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5">
            <div
              className="flex items-center rounded-(--radius-pill) border p-0.5"
              style={{ borderColor: "color-mix(in oklch, var(--ink) 18%, transparent)" }}
            >
              {(["en", "ar"] as const).map((code) => {
                const active = lang === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => switchTo(code)}
                    aria-pressed={active}
                    className={`rounded-(--radius-pill) px-3 py-1 text-xs font-semibold tracking-[0.08em] transition-colors ${active ? "bg-ink text-canvas" : "text-ink/45 hover:text-ink"
                      }`}
                  >
                    {dict.langSwitch[code]}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-5 uppercase">
              <span>{dict.footer.currency}</span>
              <Dot />
              <span>{dict.footer.madeIn}</span>
              <Dot />
              <span>{dict.footer.secureCheckout}</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  isAr,
  children,
}: {
  title: string;
  isAr: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full border-b border-[color-mix(in_oklch,var(--ink)_12%,transparent)] pb-8 last:border-b-0 last:pb-0 min-[380px]:w-auto min-[380px]:border-b-0 min-[380px]:pb-0">
      <div className={`mb-6 text-md tracking-[0.12em] sm:text-md sm:tracking-[0.3em] text-ink/80 font-extrabold ${isAr ? "" : "uppercase"}`}>
        {title}
      </div>
      <div className="grid gap-3">{children}</div>
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
  const cls = "block text-sm leading-snug tracking-wide text-ink/80 transition-colors duration-200 hover:text-ink hover:underline cursor-pointer font-bold";
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

/* A neutral white card that lets each payment brand keep its own colors. */
function PayChip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span
      aria-label={label}
      title={label}
      className="flex h-9 w-[3.4rem] items-center justify-center rounded-md bg-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] ring-1 ring-black/5"
    >
      {children}
    </span>
  );
}

/* App-store style dark pill with a two-line label. href is empty until the apps ship. */
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
    <a
      href={href}
      onClick={href ? undefined : (e) => e.preventDefault()}
      style={{ color: "#fff" }}
      className="flex h-12 items-center gap-2.5 rounded-lg bg-black px-4 transition-opacity duration-200 hover:opacity-85 cursor-pointer"
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex flex-col leading-none">
        <span className="text-[0.6rem] tracking-wide opacity-80">{top}</span>
        <span className="text-sm font-semibold leading-tight">{bottom}</span>
      </span>
    </a>
  );
}

function Dot() {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 3,
        height: 3,
        borderRadius: "50%",
        background: "color-mix(in oklch, var(--ink) 40%, transparent)",
        verticalAlign: "middle",
      }}
    />
  );
}
