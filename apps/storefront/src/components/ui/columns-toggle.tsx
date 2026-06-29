"use client";

import type { Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";

export type Cols = 1 | 2;

/**
 * Segmented "POV" control that switches a card grid between one big card per row
 * and a denser multi-card row. Stateless — the parent owns the `cols` value.
 */
export function ColumnsToggle({
  cols,
  onChange,
  lang,
  className
}: {
  cols: Cols;
  onChange: (cols: Cols) => void;
  lang: Language;
  className?: string;
}) {
  const isAr = lang === "ar";

  return (
    <div
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border border-(--hairline-strong) bg-surface p-0.5${
        className ? ` ${className}` : ""
      }`}
      role="group"
      aria-label={isAr ? "عدد الأعمدة" : "Columns per row"}
      data-testid="columns-toggle"
    >
      {([1, 2] as Cols[]).map((value) => {
        const active = cols === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            aria-pressed={active}
            aria-label={isAr ? `${value} لكل صف` : `${value} per row`}
            className={`inline-flex size-7 items-center justify-center rounded-full transition-colors duration-200 ${
              active ? "bg-ink text-canvas" : "text-(--ink-3) hover:text-ink"
            }`}
          >
            {value === 1 ? <Icon.ColumnsOne size={15} /> : <Icon.ColumnsTwo size={15} />}
          </button>
        );
      })}
    </div>
  );
}
