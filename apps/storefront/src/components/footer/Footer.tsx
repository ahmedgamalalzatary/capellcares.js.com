import { FacebookIcon, InstagramIcon, TikTokIcon } from "../icons";
import { Logo } from "../Logo";
import { PaymentMethods } from "./PaymentMethods";

const CATEGORIES = ["Men", "Women", "Kids", "New Arrivals", "Sales"];
const USEFUL_LINKS = ["About Us", "Contact Us", "Orders", "My Account"];
const POLICIES = ["Privacy Policy", "Shipping Policy", "Return & Exchange"];

const SOCIALS = [
  { label: "Facebook", Icon: FacebookIcon },
  { label: "Instagram", Icon: InstagramIcon },
  { label: "TikTok", Icon: TikTokIcon },
];

function LinkColumn({ title, links }: { title: string; links: string[] }) {
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

/** Site footer: about/social, link columns, newsletter, and bottom bar. */
export function Footer() {
  return (
    <footer className="bg-footer-bg text-white">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.3fr]">
          {/* About */}
          <div className="max-w-md">
            <h3 className="mb-5 text-lg font-bold">About Minikoshk</h3>
            <p className="text-sm leading-relaxed text-footer-text">
              Our daily physical contact point with earth is our feet. This
              contact grounds us, takes us forward, offers us potential and,
              above all, carries us with our dreams, ambitions, duties &
              experiences. Minikoshk believes this contact, which we share as humans,
              should be all about comfort, ease, character, flexibility &
              freedom. Minikoshk celebrates the freedom to express what&apos;s
              possible in our lives.
            </p>

            <h4 className="mb-3 mt-8 text-base font-bold">Social Links:</h4>
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

          <LinkColumn title="Categories" links={CATEGORIES} />
          <LinkColumn title="Useful Links" links={USEFUL_LINKS} />

          {/* Policies + newsletter */}
          <div>
            <h3 className="mb-5 text-lg font-bold">Policies</h3>
            <ul className="space-y-3 text-sm text-footer-text">
              {POLICIES.map((link) => (
                <li key={link}>
                  <a href="#" className="transition hover:text-brand-red">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-footer-border">
        <div className="container flex flex-col items-center gap-6 py-6 text-xs tracking-widest text-footer-muted lg:flex-row lg:justify-between">
          <span>
            © 2026 MINIKOSHK · CRAFTED BY{" "}
            <span className="font-semibold text-footer-heading">ZENITH WEAVE</span>
          </span>

          <Logo size={64} />

          <PaymentMethods />
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-50">
      </div>
    </footer>
  );
}
