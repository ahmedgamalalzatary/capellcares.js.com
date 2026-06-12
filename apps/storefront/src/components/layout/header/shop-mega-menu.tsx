"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import type { HeaderMenuEntry } from "@/lib/header-menu";
import type { NavNode } from "@/lib/nav";

type ShopMegaMenuProps = {
  lang: Language;
  dict: any;
  menuEntries: HeaderMenuEntry[];
  isAr: boolean;
};

export function ShopMegaMenu({ lang, dict, menuEntries }: ShopMegaMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeRoot, setActiveRoot] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }, [cancelClose]);
  // Navigating away should dismiss the panel immediately, not wait for mouseleave.
  const closeNow = useCallback(() => {
    cancelClose();
    setOpen(false);
  }, [cancelClose]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  // Offers sit 3rd (after the product tabs); Collections always come last.
  const roots = [
    ...menuEntries.filter((entry) => entry.type === "products"),
    ...menuEntries.filter((entry) => entry.type === "offers"),
    ...menuEntries
      .filter((entry) => entry.type === "category")
      .slice()
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.label.localeCompare(right.label)),
    ...menuEntries.filter((entry) => entry.type === "collections")
  ];
  const active = roots[activeRoot];

  if (roots.length === 0) return null;

  return (
    <div
      className="hidden min-[880px]:block"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Shop"
        className={`inline-flex h-10 items-center gap-2 rounded-full border-0 bg-transparent px-3 text-ink transition-colors hover:bg-(--warm-soft) ${open ? "bg-(--warm-soft)" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon.Shop />
      </button>

      {/* Full-width panel — anchored to the header so it reads as one piece. */}
      <div
        className={[
          "mr-6 ml-6 absolute inset-x-0 top-full z-40 rounded-b-2xl bg-canvas shadow-(--shadow-2)",
          open ? "pointer-events-auto" : "pointer-events-none"
        ].join(" ")}
        role="menu"
        style={{
          transformOrigin: "top",
          transition:
            "clip-path 340ms var(--ease-out-expo), opacity 220ms ease, transform 340ms var(--ease-out-expo)",
          clipPath: open
            ? "inset(0 0 0 0 round 0 0 16px 16px)"
            : "inset(0 0 100% 0 round 0 0 16px 16px)",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(-6px)"
        }}
      >
        <div className="container">
          {/* Father tabs */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-b border-(--hairline) py-4">
            {roots.map((g, i) => {
              const label = g.label;
              return (
                <button
                  key={g.key}
                  type="button"
                  onMouseEnter={() => setActiveRoot(i)}
                  onFocus={() => setActiveRoot(i)}
                  className={[
                    "relative whitespace-nowrap pb-1 tracking-[0.02em] transition-colors",
                    i === activeRoot ? "text-ink" : "text-(--ink-3) hover:text-ink"
                  ].join(" ")}
                >
                  <span className="text-lg font-semibold uppercase">{label}</span>
                  <span
                    className={`absolute inset-x-0 -bottom-px h-0.5 bg-accent transition-opacity ${i === activeRoot ? "opacity-100" : "opacity-0"}`}
                  />
                </button>
              );
            })}
          </div>

          {/* Recursive descendants beneath the active root */}
          {active && (
            <div className="max-h-[70vh] overflow-y-auto py-8">
              {active.type === "products" ? (
                <div className="grid gap-x-8 gap-y-4 grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
                  {/* "All New / All Bestsellers" sits beside the products, like the categories' "All {category}" */}
                  <Link
                    href={`/${lang}/${active.slug}`}
                    onClick={closeNow}
                    className="block truncate px-4 py-3 text-base text-ink capitalize transition-colors hover:font-bold hover:underline"
                  >
                    {dict.nav.viewAllCategory.replace("{name}", active.label)}
                  </Link>
                  {active.products.map((product) => (
                    <Link
                      key={product.id}
                      href={`/${lang}/products/${product.slug}`}
                      onClick={closeNow}
                      className="block truncate px-4 py-3 text-base text-ink capitalize transition-colors hover:font-bold hover:underline"
                    >
                      {product.label}
                    </Link>
                  ))}
                </div>
              ) : active.type === "offers" || active.type === "collections" ? (
                <MediaGrid
                  lang={lang}
                  basePath={active.type === "offers" ? "offers" : "collections"}
                  allLabel={dict.nav.viewAllCategory.replace("{name}", active.label)}
                  items={active.type === "offers" ? active.offers : active.collections}
                  onNavigate={closeNow}
                />
              ) : (
                <div className="grid gap-x-8 gap-y-4 grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
                  {/* "All {category}" sits beside the sub-categories */}
                  <Link
                    href={`/${lang}/category/${active.slug}`}
                    onClick={closeNow}
                    className="block truncate px-4 py-3 text-base text-ink capitalize transition-colors hover:font-bold hover:underline"
                  >
                    {dict.nav.viewAllCategory.replace("{name}", active.label)}
                  </Link>
                  {active.children.map((child) => (
                    <NavBranch key={child.id} lang={lang} node={child} onNavigate={closeNow} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MediaGrid({
  lang,
  basePath,
  allLabel,
  items,
  onNavigate
}: {
  lang: Language;
  basePath: "offers" | "collections";
  allLabel: string;
  items: { id: number; slug: string; label: string }[];
  onNavigate: () => void;
}) {
  return (
    <div className="grid gap-x-8 gap-y-4 grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
      {/* "All Offers / All Collections" sits beside the items, like the categories' "All {category}" */}
      <Link
        href={`/${lang}/${basePath}`}
        onClick={onNavigate}
        className="block truncate px-4 py-3 text-base text-ink capitalize transition-colors hover:font-bold hover:underline"
      >
        {allLabel}
      </Link>
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/${lang}/${basePath}/${item.slug}`}
          onClick={onNavigate}
          className="block truncate px-4 py-3 text-base text-ink capitalize transition-colors hover:font-bold hover:underline"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function NavBranch({ lang, node, onNavigate }: { lang: Language; node: NavNode; onNavigate: () => void }) {
  return (
    <div className="min-w-0">
      <Link
        href={`/${lang}/category/${node.slug}`}
        onClick={onNavigate}
        className="block truncate px-4 py-3 text-base text-ink capitalize transition-colors hover:font-bold hover:underline"
      >
        {node.label}
      </Link>
    </div>
  );
}
