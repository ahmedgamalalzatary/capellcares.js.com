"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Check, FileText, ImageOff, Languages, Search } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { catalogHealth, HealthCheck } from "@/features/dashboard/lib/metrics";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const checks: Array<{ key: HealthCheck; label: string; icon: ReactNode }> = [
  { key: "image", label: "بدون صورة", icon: <ImageOff /> },
  { key: "englishName", label: "بدون اسم إنجليزي", icon: <Languages /> },
  { key: "description", label: "وصف ناقص", icon: <FileText /> },
  { key: "keywords", label: "بدون كلمات بحث", icon: <Search /> },
];

/** How complete the product pages are, as one score, plus the products behind each gap one click away. */
export function CatalogHealth({ health, loaded }: { health: ReturnType<typeof catalogHealth>; loaded: boolean }) {
  const [open, setOpen] = useState<HealthCheck | null>(null);
  const score = health.score ?? 100;
  const openList = open ? health.missing[open] : [];

  return (
    <Card aria-label="جودة الكتالوج">
      <CardHeader title="جودة الكتالوج" description="نسبة البيانات المكتملة في صفحات المنتجات على المتجر." />
      <CardBody className="grid gap-5">
        {!loaded ? (
          <Skeleton className="h-28 w-full rounded-well" />
        ) : (
          <>
            <div className="flex items-center gap-4">
              <span className="num text-2xl font-bold text-text-strong">{`${formatNumber(score)}%`}</span>
              <span aria-hidden className="h-2.5 flex-1 overflow-hidden rounded-full bg-sunken">
                <span
                  className={cn("block h-full rounded-full", score >= 90 ? "bg-success" : score >= 70 ? "bg-warning" : "bg-danger")}
                  style={{ width: `${score}%` }}
                />
              </span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {checks.map((check) => {
                const count = health.missing[check.key].length;
                const selected = open === check.key;
                return (
                  <button
                    key={check.key}
                    type="button"
                    disabled={count === 0}
                    aria-expanded={count === 0 ? undefined : selected}
                    onClick={() => setOpen(selected ? null : check.key)}
                    className={cn(
                      "flex items-center gap-3 rounded-control p-3 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                      selected ? "bg-hover shadow-[inset_0_0_0_1px_var(--line-strong)]" : "bg-sunken hover:bg-hover",
                      "disabled:cursor-default disabled:hover:bg-sunken",
                    )}
                  >
                    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-control bg-surface text-text-2 shadow-inset [&_svg]:size-4">
                      {count === 0 ? <Check className="text-success" /> : check.icon}
                    </span>
                    <span className="grid min-w-0 gap-0.5">
                      <span className="text-sm text-text-muted">{check.label}</span>
                      <span className={cn("text-base font-bold", count === 0 ? "text-success" : "text-text-strong")}>
                        {count === 0 ? "مكتمل" : <span className="num">{formatNumber(count)}</span>}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {open && openList.length > 0 ? (
              <ul className="flex flex-wrap gap-2 border-t border-line pt-5">
                {openList.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/products/${product.id}/edit`}
                      className="block rounded-full bg-sunken px-3 py-1 text-sm text-text-2 transition-colors hover:bg-hover hover:text-text-strong"
                    >
                      {product.name.ar || product.name.en}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
