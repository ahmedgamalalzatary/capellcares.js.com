"use client";

import type { Language } from "@capella/shared";

export function PriceInput({
  value,
  onChange,
  placeholder,
  lang,
  dark = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  lang: Language;
  dark?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: dark ? "oklch(1 0 0 / 0.06)" : "var(--surface)",
        border: dark ? "1px solid oklch(1 0 0 / 0.14)" : "1px solid var(--hairline)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        transition: "border-color 180ms, box-shadow 180ms"
      }}
    >
      <span
        style={{
          paddingInlineStart: "12px",
          fontSize: "10.5px",
          letterSpacing: "0.06em",
          color: dark ? "oklch(0.94 0.06 85 / 0.45)" : "var(--ink-3)",
          fontWeight: 600,
          flexShrink: 0,
          userSelect: "none"
        }}
      >
        {lang === "ar" ? "ج.م" : "EGP"}
      </span>
      <input
        type="number"
        min="0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          minWidth: 0,
          border: 0,
          background: "transparent",
          outline: "none",
          padding: "9px 12px",
          fontSize: "13px",
          color: dark ? "oklch(0.97 0.03 85)" : "var(--text)"
        }}
      />
    </div>
  );
}
