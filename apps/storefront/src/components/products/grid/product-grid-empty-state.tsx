"use client";

import type { Language } from "@capella/shared";

import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface ProductGridEmptyStateProps {
  lang: Language;
  dict: any;
  hasActiveFilters: boolean;
  onClear: () => void;
}

export function ProductGridEmptyState({
  lang,
  dict,
  hasActiveFilters,
  onClear
}: ProductGridEmptyStateProps) {
  const isAr = lang === "ar";

  return (
    // `[display:grid]`, not `grid`: the global `.grid` class carries its own
    // 24px gap that would override the gap utility here.
    <div className="mx-auto max-w-[420px] [display:grid] gap-4 rounded-(--radius-xl) border border-(--hairline) bg-surface px-8 py-12 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-(--warm-soft)">
        <Icon.Search size={22} className="text-warm" />
      </div>
      <span
        className={cn(
          "text-[24px] text-ink",
          isAr
            ? "font-(family-name:--font-ar) font-bold tracking-[-0.01em]"
            : "font-(family-name:--font-display) font-medium tracking-[-0.02em]"
        )}
      >
        {dict.common.empty}
      </span>
      <p className="m-0 text-[13.5px] leading-[1.7] text-(--ink-2)">
        {dict.filters?.emptyDesc ?? "Try adjusting your filters or search for something else."}
      </p>
      {hasActiveFilters && (
        <button onClick={onClear} className="btn btn--ghost btn--sm justify-self-center">
          {dict.common.clear}
        </button>
      )}
    </div>
  );
}
