"use client";

import { Fragment, useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import type { Category } from "@capella/shared";
import { Select } from "@/components/ui/input";

interface Props {
  categories: Category[];
  value: number | null;
  onChange: (id: number | null) => void;
  id?: string;
}

// Chained dropdowns that drill down to a leaf category.
export function CategoryPicker({ categories, value, onChange, id }: Props) {
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const childrenOf = useMemo(() => {
    const m = new Map<number | null, Category[]>();
    for (const c of categories) {
      if (c.deletedAt) continue;
      const list = m.get(c.parentId) ?? [];
      list.push(c);
      m.set(c.parentId, list);
    }
    return m;
  }, [categories]);

  const path = useMemo(() => {
    const out: Category[] = [];
    let cur = value != null ? byId.get(value) ?? null : null;
    while (cur) {
      out.unshift(cur);
      cur = cur.parentId != null ? byId.get(cur.parentId) ?? null : null;
    }
    return out;
  }, [value, byId]);

  const levels: Category[][] = useMemo(() => {
    const out: Category[][] = [];
    out.push(childrenOf.get(null) ?? []);
    for (const p of path) {
      const kids = childrenOf.get(p.id);
      if (kids && kids.length > 0) out.push(kids);
    }
    return out;
  }, [path, childrenOf]);

  return (
    <div className="grid gap-2">
      {/* Levels sit side by side when the surrounding form section is wide enough. */}
      <div className="grid gap-2 @lg:grid-cols-2">
        {levels.map((level, depth) => (
          <Select
            key={depth}
            id={depth === 0 ? id : undefined}
            aria-label={depth === 0 ? undefined : `القسم الفرعي ${depth}`}
            className="w-full"
            value={path[depth]?.id ?? ""}
            onChange={(e) => {
              // Clearing a sub-level keeps the parent picked instead of wiping the whole path.
              const picked = e.target.value ? Number(e.target.value) : null;
              onChange(picked ?? path[depth - 1]?.id ?? null);
            }}
          >
            <option value="">{depth === 0 ? "اختاري القسم" : "بدون قسم فرعي"}</option>
            {level.map((c) => (
              <option key={c.id} value={c.id}>{c.name.ar}</option>
            ))}
          </Select>
        ))}
      </div>
      {path.length > 1 ? (
        <p className="flex flex-wrap items-center gap-1 text-xs text-text-muted">
          {path.map((p, index) => (
            <Fragment key={p.id}>
              {index > 0 ? <ChevronLeft aria-hidden className="size-3.5" /> : null}
              <span className={index === path.length - 1 ? "font-medium text-text-2" : undefined}>{p.name.ar}</span>
            </Fragment>
          ))}
        </p>
      ) : null}
    </div>
  );
}
