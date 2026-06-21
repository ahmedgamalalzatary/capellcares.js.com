"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { compareHeaderCategoryEntries, type HeaderMenuEntry } from "@/lib/header-menu";
import type { NavNode } from "@/lib/nav";

type ShopMegaMenuProps = {
  lang: Language;
  dict: any;
  menuEntries: HeaderMenuEntry[];
  isAr: boolean;
};

export function ShopMegaMenu({ lang, dict, menuEntries, isAr }: ShopMegaMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeRoot, setActiveRoot] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mirror the mobile drawer: switching tabs slides the new group in from the
  // trailing side (mirrored in RTL) instead of swapping instantly.
  const selectRoot = useCallback((index: number) => {
    setActiveRoot((current) => {
      if (index !== current) setDir(index > current ? 1 : -1);
      return index;
    });
  }, []);
  const fromRight = dir === 1 ? !isAr : isAr;

  // Clipped max-height reveal, like the mobile drawer: the panel grows down from
  // under the bar on open and collapses up on close. Measure the content's real
  // height so the reveal animates to an exact value (remeasure when the active
  // tab changes its height).
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelH, setPanelH] = useState<number>();
  useEffect(() => {
    if (open) setPanelH(panelRef.current?.scrollHeight);
  }, [open, activeRoot]);

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

  // Categories come first; Collections always come last.
  const roots = [
    ...menuEntries
      .filter((entry) => entry.type === "category")
      .slice()
      .sort(compareHeaderCategoryEntries),
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
        <Icon.Shop size={24} />
      </button>

      {/* Full-width panel — anchored to the header so it reads as one piece. */}
      <div
        className={[
          "mr-6 ml-6 absolute inset-x-0 top-full z-40 overflow-hidden rounded-b-2xl bg-canvas shadow-(--shadow-2)",
          open ? "pointer-events-auto" : "pointer-events-none"
        ].join(" ")}
        role="menu"
        style={{
          maxHeight: open ? (panelH ? `${panelH}px` : "80vh") : 0,
          opacity: open ? 1 : 0,
          transition:
            "max-height 1000ms cubic-bezier(0.76,0,0.24,1), opacity 220ms ease"
        }}
      >
        <div ref={panelRef} className="container">
          {/* Father tabs */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-b border-(--hairline) py-4">
            {roots.map((g, i) => {
              const label = g.label;
              return (
                <button
                  key={g.key}
                  type="button"
                  onMouseEnter={() => selectRoot(i)}
                  onFocus={() => selectRoot(i)}
                  className={[
                    "relative whitespace-nowrap pb-1 tracking-[0.02em] transition-colors",
                    i === activeRoot ? "text-ink" : "text-(--ink-3) hover:text-ink"
                  ].join(" ")}
                >
                  <span className="text-md font-bold uppercase">{label}</span>
                  <span
                    className={`absolute inset-x-0 -bottom-px h-0.5 bg-accent transition-opacity ${i === activeRoot ? "opacity-100" : "opacity-0"}`}
                  />
                </button>
              );
            })}
          </div>

          {/* Recursive descendants beneath the active root. The incoming group
              slides in from the trailing side, matching the mobile drawer. */}
          {active && (
            <div className="max-h-[70vh] overflow-x-hidden overflow-y-auto py-8">
              <div
                key={activeRoot}
                className={`animate-in duration-300 ${fromRight ? "slide-in-from-right-16" : "slide-in-from-left-16"}`}
              >
              {active.type === "collections" ? (
                <MediaGrid
                  lang={lang}
                  basePath="collections"
                  allLabel={dict.nav.viewAllCategory.replace("{name}", active.label)}
                  items={active.collections}
                  onNavigate={closeNow}
                />
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
                  {/* "All {category}" sits beside the sub-categories */}
                  <Link
                    href={`/${lang}/category/${active.slug}`}
                    onClick={closeNow}
                    className="block text-base text-ink uppercase transition-colors hover:font-bold hover:underline"
                  >
                    {dict.nav.viewAllCategory.replace("{name}", active.label)}
                  </Link>
                  {active.children.map((child) => (
                    <NavBranch key={child.id} lang={lang} node={child} onNavigate={closeNow} />
                  ))}
                </div>
              )}
              </div>
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
  basePath: "collections";
  allLabel: string;
  items: { id: number; slug: string; label: string }[];
  onNavigate: () => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
      {/* "All Offers / All Collections" sits beside the items, like the categories' "All {category}" */}
      <Link
        href={`/${lang}/${basePath}`}
        onClick={onNavigate}
        className="block text-base text-ink uppercase transition-colors hover:font-bold hover:underline"
      >
        {allLabel}
      </Link>
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/${lang}/${basePath}/${item.slug}`}
          onClick={onNavigate}
          className="block text-base text-ink uppercase transition-colors hover:font-bold hover:underline"
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
        aria-label={node.label}
        onClick={onNavigate}
        className="flex items-center gap-3 text-base text-ink uppercase transition-colors hover:font-bold hover:underline"
      >
        {node.imagePath ? (
          <img
            src={node.imagePath}
            alt={node.label}
            className="h-12 w-12 shrink-0 rounded-md object-cover"
          />
        ) : null}
        <span>{node.label}</span>
      </Link>
    </div>
  );
}
