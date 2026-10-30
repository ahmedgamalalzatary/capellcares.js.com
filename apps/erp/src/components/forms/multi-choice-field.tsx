"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pick several items from a short list: pills that toggle, so every choice stays visible (a native multi-select is unusable on phones). */
export function MultiChoiceField({
  legend,
  options,
  value,
  onChange,
  emptyText
}: {
  legend: string;
  options: Array<{ id: number; label: string }>;
  value: number[];
  onChange: (value: number[]) => void;
  emptyText: string;
}) {
  if (options.length === 0) {
    return <p className="text-sm text-text-muted">{emptyText}</p>;
  }

  return (
    <div role="group" aria-label={legend} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const selected = value.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? value.filter((id) => id !== option.id) : [...value, option.id])}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors pointer-coarse:h-11",
              selected
                ? "bg-nude-soft text-text-strong shadow-[inset_0_0_0_1px_var(--nude-strong)]"
                : "bg-sunken text-text-2 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-hover"
            )}
          >
            {selected ? <Check aria-hidden className="size-3.5" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
