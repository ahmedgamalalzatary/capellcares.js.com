import type { Language } from "@capella/shared";

import { ComingSoon } from "@/components/ui/coming-soon";

/** What an empty category's page shows in place of the product grid: no visible product sits in it or beneath it yet. */
export function CategoryComingSoon({ lang, dict }: { lang: Language; dict: any }) {
  return (
    <ComingSoon
      lang={lang}
      title={dict.category.comingSoonTitle}
      description={dict.category.comingSoonDesc}
      href={`/${lang}/products`}
      cta={dict.cart.keepShopping}
    />
  );
}
