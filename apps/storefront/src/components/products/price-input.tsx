"use client";

import { getDict, type Language } from "@capella/shared";

export function PriceInput({
  value,
  onChange,
  placeholder,
  lang
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  lang: Language;
}) {
  const dict = getDict(lang);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
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
          color: "var(--ink-3)",
          fontWeight: 600,
          flexShrink: 0,
          userSelect: "none"
        }}
      >
        {dict.common.currency}
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
          color: "var(--text)"
        }}
      />
    </div>
  );
}
