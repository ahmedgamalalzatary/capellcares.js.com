"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Language } from "@capella/shared";
import { HEADER_SOCIAL_LINKS } from "../../constants/socials";

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

  const brandRef = useRef<HTMLHeadingElement>(null);
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
      <div className="relative px-6 py-20 text-center">
        <p className={`mb-4 text-xs tracking-[0.35em] text-ink/70 ${isAr ? "" : "uppercase"}`}>
          {dict.footer.luxuryTagline}
        </p>

        <h2
          ref={brandRef}
          className={
            isAr
              ? "font-(family-name:--font-ar) text-[clamp(52px,9vw,120px)] font-bold leading-none tracking-tight text-ink"
              : "font-(family-name:--font-signature) text-[clamp(52px,9vw,120px)] italic font-bold leading-none tracking-[-0.01em] text-ink"
          }
          style={{
            textShadow: "0 0 80px color-mix(in oklch, var(--ink) 25%, transparent)",
            transform: brandInView ? "scale(1)" : "scale(1.05)",
            transition: "transform 700ms var(--ease-out-expo)"
          }}
        >
          {dict.brand}
        </h2>

        <p className="mx-auto mt-14 max-w-[46ch] text-base leading-[1.85] text-ink/55">
          {dict.tagline}
        </p>
      </div>

      {/* Main content grid */}
      <div
        className="relative border-t"
        style={{ borderColor: "color-mix(in oklch, var(--ink) 12%, transparent)" }}
      >
        <div className="container grid gap-12 py-16 lg:grid-cols-[1.1fr_2fr]">

          {/* Newsletter / intro */}
          <div className="lg:max-w-md">
            <p className="text-xl leading-snug text-ink font-(family-name:--font-display)">
              {dict.footer.newsletterTitle}
            </p>
            <p className="mt-5 text-base leading-[1.75] text-ink/55">
              {dict.footer.newsletterSubtitle}
            </p>

            <form
              onSubmit={(e) => e.preventDefault()}
              className="mt-7 flex items-center overflow-hidden rounded-(--radius) border border-[color-mix(in_oklch,var(--ink)_18%,transparent)] bg-surface"
            >
              <input
                type="email"
                required
                placeholder={dict.footer.emailPlaceholder}
                aria-label={dict.footer.emailPlaceholder}
                className="min-w-0 flex-1 bg-transparent px-5 py-3.5 text-sm text-ink outline-none placeholder:text-ink/40"
              />
              <button
                type="submit"
                className={`shrink-0 border-s border-[color-mix(in_oklch,var(--ink)_18%,transparent)] px-5 py-3.5 text-xs font-semibold tracking-[0.18em] text-ink transition-colors hover:bg-(--warm-soft) ${isAr ? "" : "uppercase"}`}
              >
                {dict.footer.subscribe}
              </button>
            </form>

            <p className="mt-4 text-xs leading-relaxed text-ink/45">
              {dict.footer.privacyNote}
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-4 lg:border-s lg:border-[color-mix(in_oklch,var(--ink)_12%,transparent)] lg:ps-12">
            <FooterCol title={dict.footer.navigate} isAr={isAr}>
              <FooterLink href={`/${lang}/shop`}>{dict.nav.products}</FooterLink>
              <FooterLink href={`/${lang}/offers`}>{dict.nav.offers}</FooterLink>
              <FooterLink href={`/${lang}/category/skin-care`}>{dict.footer.skinCare}</FooterLink>
            </FooterCol>

            <FooterCol title={dict.footer.social} isAr={isAr}>
              {HEADER_SOCIAL_LINKS.map(({ label, href, path, stroke }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm tracking-wide text-ink/50 transition-colors duration-200 hover:text-ink"
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
              <FooterLink as="span">{dict.footer.ourStory}</FooterLink>
              <FooterLink href="https://maps.app.goo.gl/e7yyegwreC3DfEMA7?g_st=iw" external>{dict.footer.branches}</FooterLink>
              <FooterLink as="span">{dict.footer.contact}</FooterLink>
            </FooterCol>
            <FooterCol title={dict.footer.legal} isAr={isAr}>
              <FooterLink as="span">{dict.footer.terms}</FooterLink>
              <FooterLink as="span">{dict.footer.FAQ}</FooterLink>
              <FooterLink as="span">{dict.footer.cookies}</FooterLink>
            </FooterCol>
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
              {(["ar", "en"] as const).map((code) => {
                const active = lang === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => switchTo(code)}
                    aria-pressed={active}
                    className={`rounded-(--radius-pill) px-3 py-1 text-xs font-semibold tracking-[0.08em] transition-colors ${
                      active ? "bg-ink text-canvas" : "text-ink/45 hover:text-ink"
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
