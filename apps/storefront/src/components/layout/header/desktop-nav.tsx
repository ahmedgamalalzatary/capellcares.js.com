import Link from "next/link";
import type { HeaderProps } from "../../../types/header.types";

export function HeaderDesktopNav({ lang, dict, navGroups }: HeaderProps) {
  const isAr = lang === "ar";

  return (
    <nav className="relative border-t border-black bg-(--canvas) py-2.5 max-[880px]:hidden" aria-label="Primary">
      <div className="container flex flex-wrap items-center justify-center gap-1">
        <Link href={`/${lang}/shop`} className={`rounded-(--radius-pill) px-4 py-2 text-[13px] ${isAr ? "" : "uppercase tracking-[0.08em]"} text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-ink`}>
          {dict.nav.products}
        </Link>
        <div className="group relative">
          <Link href={`/${lang}/products`} className={`flex items-center gap-1 rounded-(--radius-pill) px-4 py-2 text-[13px] ${isAr ? "" : "uppercase tracking-[0.08em]"} text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-ink`}>
            {dict.nav.allCategories}
            <svg className="mt-px h-3 w-3 shrink-0 opacity-40 transition-transform duration-200 group-hover:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0 transition-[opacity,visibility] duration-200 group-hover:visible group-hover:opacity-100">
            <div className="w-max max-w-[min(960px,92vw)] overflow-hidden rounded-(--radius-lg) border border-black bg-(--surface) shadow-[0_4px_6px_oklch(0.42_0.05_45_/_0.04),0_24px_48px_oklch(0.42_0.05_45_/_0.13)]">
              <div className="h-px bg-gradient-to-r from-transparent via-(--warm) to-transparent" />
              <div className="flex items-center justify-between border-b border-black px-7 py-3.5">
                <span className={`text-(--ink-3) ${isAr ? "font-(--font-ar) text-[13px]" : "font-(--font-display) italic text-[17px] tracking-[0.01em]"}`}>
                  {dict.nav.browseByCategory}
                </span>
                <Link
                  href={`/${lang}/products`}
                  className={`text-[11px] text-(--accent) transition-opacity hover:opacity-70 ${isAr ? "font-(--font-ar)" : "uppercase tracking-[0.14em]"}`}
                >
                  {dict.nav.viewAll}
                </Link>
              </div>

              <div className="grid auto-cols-max grid-flow-col divide-x divide-(--hairline)">
                {navGroups.slice(2).map((g) => (
                  <div key={g.root.id} className="flex w-max min-w-[140px] flex-col gap-0 px-6 py-5">
                    <Link
                      href={`/${lang}/category/${g.root.slug}`}
                      className={`group/cat mb-0.5 block transition-colors hover:text-(--accent) ${isAr ? "font-(--font-ar) text-[14px] font-semibold text-(--ink)" : "font-(--font-display) italic text-[19px] leading-[1.1] text-(--ink)"}`}
                    >
                      {isAr ? g.root.name.ar : g.root.name.en}
                    </Link>
                    <div className="mb-3 mt-2 h-px w-6 bg-(--warm) opacity-60" />
                    <div className="flex flex-col gap-1.5">
                      {g.children.map((child) => (
                        <Link
                          key={child.id}
                          href={`/${lang}/category/${child.slug}`}
                          className="group/link flex items-center gap-1.5 text-[12.5px] leading-[1.45] text-(--ink-3) transition-colors hover:text-(--accent)"
                        >
                          <span className="inline-block h-px w-2.5 shrink-0 bg-(--warm) opacity-0 transition-opacity group-hover/link:opacity-60" />
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-black bg-gradient-to-r from-(--warm-soft) via-(--canvas) to-(--warm-soft) px-7 py-3">
                <Link
                  href={`/${lang}/products`}
                  className={`text-(--ink-2) transition-colors hover:text-(--accent) ${isAr ? "font-(--font-ar) text-[12px]" : "font-(--font-display) italic text-[14px]"}`}
                >
                  {dict.nav.exploreCollection}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {navGroups.slice(2).filter(g => g.children.some(c => c.grandchildren.length > 0)).map((g) => (
          <div key={g.root.id} className="group relative">
            <Link
              href={`/${lang}/category/${g.root.slug}`}
              className={`flex items-center gap-1 rounded-(--radius-pill) px-4 py-2 text-[13px] ${isAr ? "" : "uppercase tracking-[0.08em]"} text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-ink`}
            >
              {isAr ? g.root.name.ar : g.root.name.en}
              <svg className="mt-px h-3 w-3 shrink-0 opacity-40 transition-transform duration-200 group-hover:rotate-180" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>

            <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0 transition-[opacity,visibility] duration-150 group-hover:visible group-hover:opacity-100">
              <div className="min-w-[520px] max-w-[820px] rounded-(--radius-lg) border border-black bg-(--canvas) p-6 shadow-[0_8px_30px_rgba(0,0,0,0.10)]">
                <div className={`grid gap-x-8 gap-y-1 ${g.children.length <= 2 ? "grid-cols-2" : g.children.length <= 4 ? "grid-cols-3" : "grid-cols-4"}`}>
                  {g.children.map((child) => (
                    <div key={child.id} className="flex flex-col gap-1">
                      <Link
                        href={`/${lang}/category/${child.slug}`}
                        className={`mb-1.5 block text-[12px] font-semibold text-(--ink) transition-colors hover:text-(--accent) ${isAr ? "font-(--font-ar)" : "uppercase tracking-[0.1em]"}`}
                      >
                        {child.label}
                      </Link>
                      {child.grandchildren.map((gc) => (
                        <Link
                          key={gc.id}
                          href={`/${lang}/category/${gc.slug}`}
                          className="block text-[13px] leading-[1.4] text-(--ink-2) transition-colors hover:text-(--accent)"
                        >
                          {gc.label}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-5 border-t border-black pt-4">
                  <Link
                    href={`/${lang}/category/${g.root.slug}`}
                    className={`text-[12px] font-medium text-(--accent) transition-colors hover:underline underline-offset-4 ${isAr ? "" : "uppercase tracking-[0.08em]"}`}
                  >
                    {dict.nav.viewAllCategory.replace("{name}", isAr ? g.root.name.ar : g.root.name.en)}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}

        <Link href={`/${lang}/offers`} className={`rounded-(--radius-pill) px-4 py-2 text-[13px] ${isAr ? "" : "uppercase tracking-[0.08em]"} text-accent transition-colors hover:bg-(--accent-soft)`}>
          {dict.nav.offers}
        </Link>
      </div>
    </nav>
  );
}
