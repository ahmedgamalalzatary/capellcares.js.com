"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { InputWithIcon } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";

export function SelectionGroup({ title, prefix, items, selected, onToggle }: {
  title: string;
  prefix: string;
  items: Array<{ id: number; label: string; depth?: number }>;
  selected: number[];
  onToggle: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const visible = items.filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <section className="grid content-start gap-3 rounded-well bg-sunken p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-text-strong">{title}</h3>
        <Badge tone={selected.length > 0 ? "nude" : "neutral"} swatch={false}>
          <span className="num">{formatNumber(selected.length)}</span> مختار
        </Badge>
      </div>
      <InputWithIcon
        icon={<Search />}
        type="search"
        aria-label={`بحث في ${title}`}
        placeholder={`ابحثي في ${title}`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div role="group" aria-label={title} className="grid max-h-56 gap-0.5 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-text-muted">لا توجد نتائج.</p>
        ) : (
          visible.map((item) => (
            <label key={item.id} className="flex min-h-9 cursor-pointer items-center gap-3 rounded-md px-2.5 transition-colors hover:bg-hover pointer-coarse:min-h-11">
              <input type="checkbox" className="size-4 shrink-0" aria-label={`${prefix}: ${item.label}`} checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
              <span className="min-w-0 truncate text-base text-text" style={{ paddingInlineStart: `${(item.depth ?? 0) * 14}px` }}>{item.label}</span>
            </label>
          ))
        )}
      </div>
    </section>
  );
}
