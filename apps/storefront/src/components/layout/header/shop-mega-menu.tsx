"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import type { NavGroup } from "@/lib/nav";

type ShopMegaMenuProps = {
  lang: Language;
  navGroups: NavGroup[];
  isAr: boolean;
};

export function ShopMegaMenu({ lang, navGroups, isAr }: ShopMegaMenuProps) {
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

  const roots = navGroups;
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
              const label = isAr ? g.root.name.ar : g.root.name.en;
              return (
                <button
                  key={g.root.id}
                  type="button"
                  onMouseEnter={() => setActiveRoot(i)}
                  onFocus={() => setActiveRoot(i)}
                  className={[
                    "relative whitespace-nowrap pb-1 tracking-[0.02em] transition-colors",
                    i === activeRoot ? "text-ink" : "text-(--ink-3) hover:text-ink"
                  ].join(" ")}
                >
                  <span className="text-3xl font-extrabold capitalize">{label}</span>
                  <span
                    className={`absolute inset-x-0 -bottom-px h-0.5 bg-accent transition-opacity ${i === activeRoot ? "opacity-100" : "opacity-0"}`}
                  />
                </button>
              );
            })}
          </div>

          {/* Children columns with grandchildren beneath */}
          {active && (
            <div className="max-h-[70vh] overflow-y-auto py-8">
              {active.children.length === 0 ? (
                <p className="py-6 text-sm text-(--ink-3)">{isAr ? active.root.name.ar : active.root.name.en}</p>
              ) : (
                  <div className="grid gap-x-8 gap-y-9 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
                  {active.children.map((child) => (
                    <div key={child.id} className="min-w-0">
                      <Link
                        href={`/${lang}/category/${child.slug}`}
                        className="block text-lg font-bold capitalize text-ink transition-colors hover:text-accent"
                      >
                        {child.label}
                      </Link>
                      {child.grandchildren.length > 0 && (
                        <ul className="mt-3 grid gap-2">
                          {child.grandchildren.map((gc) => (
                            <li key={gc.id}>
                              <Link
                                href={`/${lang}/category/${gc.slug}`}
                                className="text-base font-semibold capitalize text-(--ink-2) transition-colors hover:text-ink"
                              >
                                {gc.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
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
