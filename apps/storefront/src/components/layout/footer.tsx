"use client";

import Link from "next/link";
import type { Language } from "@capella/shared";
import { HEADER_SOCIAL_LINKS } from "../../constants/socials";

export function Footer({ lang, dict }: { lang: Language; dict: any }) {
  const year = new Date().getFullYear();
  const isAr = lang === "ar";

  return (
    <footer
      dir={isAr ? "rtl" : "ltr"}
      style={{ background: "var(--footer-bg)" }}
      className="relative mt-24 overflow-hidden pb-0 text-ink"
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

      {/* Hero brand mark */}
      <div
        className="relative border-b px-6 py-20 text-center"
        style={{ borderColor: "color-mix(in oklch, var(--ink) 12%, transparent)" }}
      >
        <p className={`mb-4 text-xs tracking-[0.35em] text-ink/70 ${isAr ? "" : "uppercase"}`}>
          {dict.footer.luxuryTagline}
        </p>

        <h2
          className={
            isAr
              ? "font-(family-name:--font-ar) text-[clamp(52px,9vw,120px)] font-bold leading-none tracking-tight text-ink"
              : "font-(family-name:--font-signature) text-[clamp(52px,9vw,120px)] italic font-light leading-none tracking-[-0.01em] text-ink"
          }
          style={{ textShadow: "0 0 80px color-mix(in oklch, var(--ink) 25%, transparent)" }}
        >
          {dict.brand}
        </h2>

        <p className="mx-auto mt-14 max-w-[46ch] text-base leading-[1.85] text-ink/55">
          {dict.tagline}
        </p>
      </div>

      {/* Main content grid */}
      <div className="container relative py-16">
        <div className="grid gap-12 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">

          {/* Brand philosophy + contact */}
          <div className="md:col-span-2 xl:col-span-1">
            <p className={`mb-5 text-xs tracking-[0.3em] text-ink ${isAr ? "" : "uppercase"}`}>
              {dict.footer.ourPhilosophy}
            </p>

            <blockquote
              className="mb-8 max-w-[34ch] ps-4 text-base italic leading-[1.9] text-ink/55 font-(family-name:--font-display)"
              style={{ borderInlineStart: "1.5px solid color-mix(in oklch, var(--ink) 40%, transparent)" }}
            >
              {dict.footer.philosophy}
            </blockquote>


            <div className="grid gap-3">
              <p className={`text-xs tracking-[0.25em] text-ink/70 ${isAr ? "" : "uppercase"}`}>
                {dict.footer.reachUs}
              </p>
              <a
                href="https://wa.me/96555442282"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-ink/50 transition-colors hover:text-ink"
                dir="ltr"
              >
                +965 5544 2282
              </a>
            </div>

            <div className="mt-7 flex items-center gap-4">
              {HEADER_SOCIAL_LINKS.map(({ label, href, path, stroke }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-9 w-9 items-center justify-center rounded-xl text-ink/40 transition-all hover:text-ink"
                  style={{
                    border: "1px solid color-mix(in oklch, var(--ink) 20%, transparent)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "color-mix(in oklch, var(--ink) 60%, transparent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "color-mix(in oklch, var(--ink) 20%, transparent)")}
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
          </div>

          {/* Shop col */}
          <FooterCol title={dict.footer.shopTitle} isAr={isAr}>
            <FooterLink href={`/${lang}/shop`}>{dict.nav.products}</FooterLink>
            <FooterLink href={`/${lang}/offers`}>{dict.nav.offers}</FooterLink>
            <FooterLink href={`/${lang}/category/skin-care`}>{dict.footer.skinCare}</FooterLink>
            <FooterLink href={`/${lang}/category/hair-care`}>{dict.footer.hairCare}</FooterLink>
          </FooterCol>

          {/* Capella col */}
          <FooterCol title={dict.footer.capellaTitle} isAr={isAr}>
            <FooterLink as="span">{dict.footer.ourStory}</FooterLink>
            <FooterLink as="span">{dict.product.ingredients}</FooterLink>
            <FooterLink href="https://maps.app.goo.gl/e7yyegwreC3DfEMA7?g_st=iw" external>{dict.footer.branches}</FooterLink>
            <FooterLink as="span">{dict.footer.contact}</FooterLink>
          </FooterCol>

          {/* Account col */}
          <FooterCol title={dict.nav.account} isAr={isAr}>
            <FooterLink href={`/${lang}/login`}>{dict.nav.login}</FooterLink>
            <FooterLink href={`/${lang}/signup`}>{dict.nav.signup}</FooterLink>
            <FooterLink href={`/${lang}/wishlist`}>{dict.nav.wishlist}</FooterLink>
            <FooterLink href={`/${lang}/cart`}>{dict.nav.cart}</FooterLink>
          </FooterCol>
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

          <div className="flex items-center gap-5 uppercase">
            <span>{dict.footer.currency}</span>
            <Dot />
            <span>{dict.footer.madeIn}</span>
            <Dot />
            <span>{dict.footer.secureCheckout}</span>
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
    <div>
      <div className={`mb-6 text-xs tracking-[0.3em] text-ink/80 ${isAr ? "" : "uppercase"}`}>
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
  const cls = "block text-sm leading-snug tracking-wide text-ink/50 transition-colors duration-200 hover:text-ink cursor-pointer";
  if (as === "span" || !href)
    return <span className={cls}>{children}</span>;
  if (external)
    return <a className={cls} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
  return (
    <Link className={cls} href={href}>
      {children}
    </Link>
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
