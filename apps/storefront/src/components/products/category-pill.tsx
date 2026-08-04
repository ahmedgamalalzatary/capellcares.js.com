"use client";

import { cn } from "@/lib/utils";

export function CategoryPill({
  name,
  checked,
  onChange,
  children,
  indent = false
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  indent?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer", indent ? "ms-4" : "ms-0")}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span
        className={cn(
          "flex w-full items-center rounded-(--radius) border px-[14px] transition-[background,border-color,color] duration-[180ms]",
          indent ? "h-[30px] text-[12px]" : "h-[34px] text-[13px]",
          checked
            ? "border-(--accent) bg-[oklch(0.32_0.018_85_/_0.08)] font-semibold text-(--accent)"
            : "border-transparent bg-transparent font-normal text-(--ink-3)"
        )}
      >
        {checked && (
          <span className="me-[10px] size-[5px] shrink-0 rounded-full bg-(--accent)" />
        )}
        {children}
      </span>
    </label>
  );
}
