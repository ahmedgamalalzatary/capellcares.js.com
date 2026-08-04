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
    <div className="flex items-center overflow-hidden rounded-(--radius) border border-(--hairline) bg-surface transition-[border-color,box-shadow] duration-[180ms]">
      <span className="shrink-0 select-none ps-3 text-[10.5px] font-semibold tracking-[0.06em] text-(--ink-3)">
        {dict.common.currency}
      </span>
      <input
        type="number"
        min="0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent px-3 py-[9px] text-[13px] text-(--text) outline-none"
      />
    </div>
  );
}
