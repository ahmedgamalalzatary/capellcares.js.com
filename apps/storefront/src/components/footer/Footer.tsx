"use client";

import { FacebookIcon, InstagramIcon, TikTokIcon } from "../icons";
import { Logo } from "../Logo";
import { PaymentMethods } from "./PaymentMethods";
import { useLocale } from "../i18n/LocaleProvider";

const SOCIALS = [
  { label: "Facebook", Icon: FacebookIcon },
  { label: "Instagram", Icon: InstagramIcon },
  { label: "TikTok", Icon: TikTokIcon }
];

function LinkColumn({ title, links }: { title: string; links: readonly string[] }) {
  return (
    <div>
      <h3 className="mb-5 text-lg font-bold">{title}</h3>
      <ul className="space-y-3 text-sm text-footer-text">
        {links.map((link) => (
          <li key={link}>
            <a href="#" className="transition hover:text-brand-red">
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Site footer: about/social, link columns, and bottom bar. */
export function Footer() {
  const { dict } = useLocale();
  const f = dict.footer;

  return (
    <footer className="bg-footer-bg text-white">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.3fr]">
          {/* About */}
          <div className="max-w-md">
            <h3 className="mb-5 text-lg font-bold">{f.aboutTitle}</h3>
            <p className="text-sm leading-relaxed text-footer-text">{f.aboutBody}</p>

            <h4 className="mb-3 mt-8 text-base font-bold">{f.socialLinks}</h4>
            <div className="flex items-center gap-3">
              {SOCIALS.map(({ label, Icon }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-footer-muted text-footer-heading transition hover:border-brand-red hover:text-brand-red"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <LinkColumn title={f.categoriesTitle} links={f.categories} />
          <LinkColumn title={f.usefulLinksTitle} links={f.usefulLinks} />

          <LinkColumn title={f.policiesTitle} links={f.policies} />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-footer-border">
        <div className="container flex flex-col items-center gap-6 py-6 text-xs tracking-widest text-footer-muted lg:flex-row lg:justify-between">
          <span>
            {f.copyright} <span className="font-semibold text-footer-heading">{f.craftedByName}</span>
          </span>

          <Logo size={64} />

          <PaymentMethods />
        </div>
      </div>
    </footer>
  );
}
