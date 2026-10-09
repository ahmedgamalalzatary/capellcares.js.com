"use client";

import { Swatch } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface StatusChoiceOption<T extends string> {
  value: T;
  label: string;
  hint: string;
  tone: "neutral" | "success";
}

interface Props<T extends string> {
  name: string;
  value: T;
  onChange: (value: T) => void;
  legend: string;
  options: readonly StatusChoiceOption<T>[];
}

/** Draft/active radio cards shared by the toggleable ERP forms. */
export function StatusChoice<T extends string>({ name, value, onChange, legend, options }: Props<T>) {
  return (
    <fieldset className="grid grid-cols-2 gap-2">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "grid cursor-pointer gap-0.5 rounded-control bg-surface p-3 shadow-[0_0_0_1px_var(--line-control)] transition-shadow",
            "hover:shadow-[0_0_0_1px_var(--line-strong)]",
            "has-checked:bg-sunken has-checked:shadow-[0_0_0_2px_var(--sand-900)]",
            "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            className="sr-only"
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span className="flex items-center gap-2 text-base font-medium text-text-strong">
            <Swatch tone={option.tone} />
            {option.label}
          </span>
          <span className="text-xs text-text-muted">{option.hint}</span>
        </label>
      ))}
    </fieldset>
  );
}
