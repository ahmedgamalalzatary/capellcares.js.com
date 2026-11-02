"use client";

import type { ProductColor } from "@capella/shared";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const HEX = /^#[0-9a-f]{6}$/i;

/** How the ERP names a colour: its Arabic name, else English, else the picked colour, else its position. */
export function colorLabel(color: Pick<ProductColor, "name" | "hex">, index: number) {
  return color.name.ar.trim() || color.name.en.trim() || color.hex || `لون ${formatNumber(index + 1)}`;
}

/** The picked colour as a small dot; a dashed ring when only a name was written. */
export function ColorDot({ hex, className }: { hex: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-4 shrink-0 rounded-full", hex ? "shadow-inset" : "border border-dashed border-line-strong", className)}
      style={hex ? { backgroundColor: hex } : undefined}
    />
  );
}

/** Pick from the palette or type a code; clearing the code leaves only the written name. */
export function ColorPick({ id, value, onChange }: { id: string; value: string | null; onChange: (hex: string | null) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="relative grid size-10 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-control border border-line-control">
        <span className="sr-only">اختاري من اللوحة</span>
        <ColorDot hex={value} className="size-6" />
        <input
          type="color"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={value ?? "#000000"}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
        />
      </label>
      <Input
        id={id}
        dir="ltr"
        className="num flex-1"
        placeholder="#000000"
        defaultValue={value ?? ""}
        key={value ?? ""}
        onBlur={(e) => {
          const text = e.target.value.trim();
          const hex = text && !text.startsWith("#") ? `#${text}` : text;
          if (!hex) onChange(null);
          else if (HEX.test(hex)) onChange(hex.toLowerCase());
          else e.target.value = value ?? "";
        }}
      />
    </div>
  );
}
