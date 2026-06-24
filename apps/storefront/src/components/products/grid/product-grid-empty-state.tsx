"use client";

import type { Language } from "@capella/shared";

import { Icon } from "@/components/ui/icons";

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
    <div
      style={{
        maxWidth: "420px",
        margin: "0 auto",
        display: "grid",
        gap: 16,
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--radius-xl)",
        padding: "48px 32px",
        textAlign: "center"
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--warm-soft)",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Icon.Search size={22} className="text-warm" />
      </div>
      <span
        style={{
          fontFamily: isAr ? "var(--font-ar)" : "var(--font-display)",
          fontStyle: "normal",
          fontWeight: isAr ? 700 : 500,
          fontSize: "24px",
          color: "var(--ink)",
          letterSpacing: isAr ? "-0.01em" : "-0.02em"
        }}
      >
        {dict.common.empty}
      </span>
      <p
        style={{
          fontSize: "13.5px",
          lineHeight: 1.7,
          color: "var(--ink-2)",
          margin: 0
        }}
      >
        {dict.filters?.emptyDesc ?? "Try adjusting your filters or search for something else."}
      </p>
      {hasActiveFilters && (
        <button onClick={onClear} className="btn btn--ghost btn--sm" style={{ justifySelf: "center" }}>
          {dict.common.clear}
        </button>
      )}
    </div>
  );
}
