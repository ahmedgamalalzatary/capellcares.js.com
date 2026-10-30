import Link from "next/link";
import type { Language } from "@capella/shared";

import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** A centred "coming soon" card with one way out, for pages whose content isn't ready yet. */
export function ComingSoon({
  lang,
  title,
  description,
  href,
  cta
}: {
  lang: Language;
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
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
            ? "font-(family-name:--font-ar) font-bold "
            : "font-extrabold "
        )}
      >
        {title}
      </h2>
      <p className="m-0 text-[13.5px] leading-[1.7] text-(--ink-2)">{description}</p>
      <Link href={href} className="btn btn--primary justify-self-center">
        {cta}
      </Link>
    </div>
  );
}
