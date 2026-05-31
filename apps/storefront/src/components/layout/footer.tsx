"use client";

import Link from "next/link";
import type { Language } from "@capella/shared";

export function Footer({ lang, dict }: { lang: Language; dict: any }) {
  const year = new Date().getFullYear();
  const isAr = lang === "ar";

  return (
    <footer
      dir={isAr ? "rtl" : "ltr"}
      style={{ background: "#FCF5EE" }}
      className="relative mt-24 overflow-hidden pb-0 text-(--ink)"
    >
      {/* Decorative top rule */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, color-mix(in oklch, var(--ink) 60%, transparent) 30%, var(--ink) 50%, color-mix(in oklch, var(--ink) 60%, transparent) 70%, transparent 100%)",
        }}
      />

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
        <p className={`mb-4 text-[11px] tracking-[0.35em] text-(--ink)/70 ${isAr ? "" : "uppercase"}`}>
          {dict.footer.luxuryTagline}
        </p>

        <h2
          className={
            isAr
              ? "font-(--font-ar) text-[clamp(52px,9vw,120px)] font-bold leading-none tracking-tight text-(--ink)"
              : "font-(--font-signature) text-[clamp(52px,9vw,120px)] italic font-light leading-none tracking-[-0.01em] text-(--ink)"
          }
          style={{ textShadow: "0 0 80px color-mix(in oklch, var(--ink) 25%, transparent)" }}
        >
          {dict.brand}
        </h2>

        <p className="mx-auto mt-6 max-w-[46ch] text-[15px] leading-[1.85] text-(--ink)/55">
          {dict.tagline}
        </p>
      </div>

      {/* Main content grid */}
      <div className="container relative py-16">
        <div className="grid gap-12 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">

          {/* Brand philosophy + contact */}
          <div className="md:col-span-2 xl:col-span-1">
            <p className={`mb-5 text-[11px] tracking-[0.3em] text-(--ink) ${isAr ? "" : "uppercase"}`}>
              {dict.footer.ourPhilosophy}
            </p>

            <blockquote
              className="mb-8 max-w-[34ch] ps-4 text-[15px] italic leading-[1.9] text-(--ink)/55 font-(--font-display)"
              style={{ borderInlineStart: "1.5px solid color-mix(in oklch, var(--ink) 40%, transparent)" }}
            >
              {dict.footer.philosophy}
            </blockquote>


            <div className="grid gap-3">
              <p className={`text-[11px] tracking-[0.25em] text-(--ink)/70 ${isAr ? "" : "uppercase"}`}>
                {dict.footer.reachUs}
              </p>
              <a
                href="mailto:hello@capellacare.com"
                className="text-[13px] text-(--ink)/50 transition-colors hover:text-(--ink)"
              >
                hello@capellacare.com
              </a>
            </div>

            <div className="mt-7 flex items-center gap-4">
              {[
                {
                  label: "Instagram",
                  href: "https://www.instagram.com/capellacare?igsh=aDllZTVycjc4ZjJw&utm_source=qr",
                  path: "M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5ZM12 7a5 5 0 1 1 0 10A5 5 0 0 1 12 7Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm5.25-2.25a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z",
                },
                {
                  label: "TikTok",
                  href: "https://www.tiktok.com/@capellacare?_r=1&_t=ZS-94lIE7a9ZKP",
                  path: "M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07Z",
                },
                {
                  label: "Pinterest",
                  href: "https://pinterest.com/capellacares",
                  path: "M12 2C6.48 2 2 6.48 2 12c0 4.24 2.65 7.86 6.39 9.29-.09-.78-.17-1.98.04-2.83.18-.77 1.22-5.17 1.22-5.17s-.31-.63-.31-1.56c0-1.46.85-2.55 1.9-2.55.9 0 1.33.67 1.33 1.48 0 .9-.57 2.26-.87 3.51-.25 1.05.52 1.9 1.55 1.9 1.85 0 3.1-2.37 3.1-5.18 0-2.14-1.44-3.74-4.04-3.74-2.94 0-4.77 2.2-4.77 4.64 0 .84.24 1.44.62 1.9.17.2.19.28.13.51-.04.17-.14.57-.18.73-.06.23-.24.32-.44.23-1.24-.51-1.82-1.88-1.82-3.42 0-2.54 2.15-5.6 6.42-5.6 3.45 0 5.73 2.51 5.73 5.2 0 3.56-1.97 6.23-4.88 6.23-.98 0-1.9-.53-2.21-1.12l-.6 2.31c-.22.83-.8 1.88-1.19 2.52.9.27 1.85.42 2.84.42 5.52 0 10-4.48 10-10S17.52 2 12 2Z",
                },
              ].map(({ label, href, path }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-9 w-9 items-center justify-center text-(--ink)/40 transition-all hover:text-(--ink)"
                  style={{
                    borderRadius: 2,
                    border: "1px solid color-mix(in oklch, var(--ink) 20%, transparent)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "color-mix(in oklch, var(--ink) 60%, transparent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "color-mix(in oklch, var(--ink) 20%, transparent)")}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                    <path d={path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Shop col */}
          <FooterCol title={dict.footer.shopTitle} isAr={isAr}>
            <FooterLink href={`/${lang}/products`}>{dict.nav.products}</FooterLink>
            <FooterLink href={`/${lang}/offers`}>{dict.nav.offers}</FooterLink>
            <FooterLink href={`/${lang}/category/skin-care`}>{dict.footer.skinCare}</FooterLink>
            <FooterLink href={`/${lang}/category/hair-care`}>{dict.footer.hairCare}</FooterLink>
            <FooterLink href={`/${lang}/category/fragrances`}>{dict.footer.fragrances}</FooterLink>
            <FooterLink href={`/${lang}/category/organic-oils`}>{dict.footer.organicOils}</FooterLink>
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
            <FooterLink href={`/${lang}/orders`}>{dict.nav.orders}</FooterLink>
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
        <div className="container flex flex-col items-center justify-between gap-4 py-6 text-[11px] tracking-[0.12em] text-(--ink)/35 sm:flex-row">
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

        {/* Ghost brand mark at bottom edge */}
        <div
          aria-hidden
          className={`pointer-events-none select-none overflow-hidden text-center leading-none ${
            isAr ? " font-bold" : " italic font-light"
          }`}
          style={{
            fontSize: "clamp(80px, 18vw, 220px)",
            color: "transparent",
            WebkitTextStroke: "1px var(--ink)",
            letterSpacing: "-0.02em",
            marginBottom: "-0.18em",
            lineHeight: 1,
          }}
        >
          {dict.brand}
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
      <div className={`mb-6 text-[10px] tracking-[0.3em] text-(--ink)/80 ${isAr ? "" : "uppercase"}`}>
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
  const cls = "block text-[13px] leading-snug tracking-wide text-(--ink)/50 transition-colors duration-200 hover:text-(--ink) cursor-pointer";
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
