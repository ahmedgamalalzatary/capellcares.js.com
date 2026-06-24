import Link from "next/link";
import type { Dict, Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";

type FooterLink = { label: string; href: string };

export function Footer({ lang, dict }: { lang: Language; dict: Dict }) {
  const base = `/${lang}`;
  const year = new Date().getFullYear();

  const shopLinks: FooterLink[] = [
    { label: dict.nav.new, href: `${base}/products?sort=newest` },
    { label: dict.nav.allProducts, href: `${base}/products` },
    { label: dict.nav.offers, href: `${base}/offers` },
    { label: dict.nav.collections, href: `${base}/collections` },
    { label: dict.nav.bestsellers, href: `${base}/products?filter=bestseller` }
  ];

  const usefulLinks: FooterLink[] = [
    { label: dict.footer.ourStory, href: `${base}/about` },
    { label: dict.footer.contact, href: `${base}/contact` },
    { label: dict.nav.orders, href: `${base}/orders` },
    { label: dict.nav.account, href: `${base}/account` }
  ];

  const policyLinks: FooterLink[] = [
    { label: dict.footer.privacy, href: `${base}/privacy` },
    { label: dict.footer.shippingHandling, href: `${base}/shipping` },
    { label: dict.footer.returnsRefunds, href: `${base}/returns` },
    { label: dict.footer.terms, href: `${base}/terms` }
  ];

  const socials: FooterLink[] = [
    { label: dict.footer.instagram, href: "https://instagram.com" },
    { label: dict.footer.facebook, href: "https://facebook.com" },
    { label: dict.footer.tiktok, href: "https://tiktok.com" },
    { label: dict.footer.youtube, href: "https://youtube.com" }
  ];

  return (
    <footer className="mt-20 bg-(--footer-bg) text-white">
      <div className="container grid gap-12 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-8">
        {/* Brand / about */}
        <div className="max-w-md">
          <span className="brand-wordmark block !text-[clamp(3rem,9vw,5.5rem)] leading-none">
            {dict.brand.split(" ")[0].toLowerCase()}
          </span>
          <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-(--warm)">
            {dict.footer.aboutTitle}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-white/70">{dict.footer.aboutBody}</p>
          <div className="mt-6">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
              {dict.footer.social}
            </span>
            <div className="mt-3 flex flex-wrap gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-(--warm) hover:text-(--warm)"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Link columns */}
        <FooterColumn title={dict.footer.shopTitle} links={shopLinks} />
        <FooterColumn title={dict.footer.usefulLinks} links={usefulLinks} />

        {/* Policies + newsletter */}
        <div>
          <FooterColumn title={dict.footer.policiesTitle} links={policyLinks} />
          <form className="mt-8" action={`${base}/account`}>
            <p className="text-sm leading-relaxed text-white/70">{dict.footer.joinList}</p>
            <div className="mt-3 flex overflow-hidden rounded-full border border-white/20 bg-white/5 focus-within:border-(--warm)">
              <input
                type="email"
                name="email"
                required
                placeholder={dict.footer.emailPlaceholder}
                aria-label={dict.footer.emailPlaceholder}
                className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40"
              />
              <button
                type="submit"
                className="shrink-0 bg-(--warm) px-4 text-ink transition-colors hover:bg-[#e9b62e]"
                aria-label={dict.footer.subscribe}
              >
                <Icon.Search />
              </button>
            </div>
            <p className="mt-2 text-xs text-white/40">{dict.footer.privacyNote}</p>
          </form>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-4 py-6 text-xs text-white/55 sm:flex-row">
          <span>
            © {year} {dict.brand}. {dict.footer.rights}
          </span>
          <div className="flex items-center gap-3">
            <Icon.Visa className="h-4 w-auto" />
            <Icon.Mastercard className="h-5 w-auto" />
            <Icon.Paymob className="h-4 w-auto" />
          </div>
          <span>
            {dict.footer.craftedBy} <span className="font-semibold text-white/80">{dict.footer.creator}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-(--warm)">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-white/70 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
