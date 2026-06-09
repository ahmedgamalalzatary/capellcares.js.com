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

  useEffect(() => () => cancelClose(), [cancelClose]);

  const roots = menuEntries;
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
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border-b border-(--hairline) py-4">
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
                  <span className="text-2xl capitalize">{label}</span>
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
                <>
                  {/* "All New / All Bestsellers" links to the dedicated /new and /bestsellers pages */}
                  <Link
                    href={`/${lang}/${active.slug}`}
                    className="mb-6 inline-block text-lg font-bold text-accent transition-colors hover:underline"
                  >
                    {dict.nav.viewAllCategory.replace("{name}", active.label)}
                  </Link>
                  {active.products.length > 0 ? (
                    <div className="grid gap-x-8 gap-y-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
                      {active.products.map((product) => (
                        <Link
                          key={product.id}
                          href={`/${lang}/products/${product.slug}`}
                          className="block px-4 py-3 text-base font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
                        >
                          {product.label}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="py-6 text-sm text-(--ink-3)">{active.label}</p>
                  )}
                </>
              ) : (
                <div className="grid gap-x-8 gap-y-9 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
                  {/* "All {category}" sits as its own column beside the sub-categories */}
                  <div className="min-w-0">
                    <Link
                      href={`/${lang}/category/${active.slug}`}
                      className="block text-lg font-bold text-accent transition-colors hover:underline"
                    >
                      {dict.nav.viewAllCategory.replace("{name}", active.label)}
                    </Link>
                  </div>
                  {active.children.map((child) => (
                    <div key={child.id} className="min-w-0">
                      <NavBranch lang={lang} node={child} depth={0} />
                    </div>
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

function NavBranch({ lang, node, depth }: { lang: Language; node: NavNode; depth: number }) {
  return (
    <div className="min-w-0">
      <Link
        href={`/${lang}/category/${node.slug}`}
        className={[
          "block capitalize transition-colors hover:text-accent",
          depth === 0 ? "text-lg font-bold text-ink" : "text-sm text-(--ink-2)"
        ].join(" ")}
      >
        {node.label}
      </Link>
      {node.children.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 border-l border-(--hairline) pl-4">
          {node.children.map((child) => <NavBranch key={child.id} lang={lang} node={child} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}
