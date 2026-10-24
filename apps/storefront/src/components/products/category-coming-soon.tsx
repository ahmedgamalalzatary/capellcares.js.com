import Link from "next/link";
import type { Language } from "@capella/shared";

import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** What an empty category's page shows in place of the product grid: no visible product sits in it or beneath it yet. */
export function CategoryComingSoon({ lang, dict }: { lang: Language; dict: any }) {
  const isAr = lang === "ar";

  return (
    // `[display:grid]`, not `grid`: the global `.grid` class carries its own 24px gap that would override the gap utility here.
    <div className="mx-auto my-10 max-w-[420px] [display:grid] gap-4 rounded-(--radius-xl) border border-(--hairline) bg-surface px-8 py-12 text-center sm:my-16">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-(--warm-soft)">
        <Icon.Shop size={22} className="text-warm" />
      </div>
      <h2
        className={cn(
          "m-0 text-[24px] text-ink",
          isAr
            ? "font-(family-name:--font-ar) font-bold tracking-[-0.01em]"
            : "font-(family-name:--font-display) font-medium tracking-[-0.02em]"
        )}
      >
        {dict.category.comingSoonTitle}
      </h2>
      <p className="m-0 text-[13.5px] leading-[1.7] text-(--ink-2)">{dict.category.comingSoonDesc}</p>
      <Link href={`/${lang}/products`} className="btn btn--primary justify-self-center">
        {dict.cart.keepShopping}
      </Link>
    </div>
  );
}
