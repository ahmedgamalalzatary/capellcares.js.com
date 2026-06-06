"use client";

import { useMemo } from "react";
import type { Category } from "@capella/shared";

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
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${levels.length}, minmax(0, 1fr))`, gap: 8 }}>
        {levels.map((level, depth) => {
          const selectedAtDepth = path[depth]?.id ?? "";
          return (
            <select
              key={depth}
              id={depth === 0 ? id : undefined}
              className="select"
              value={selectedAtDepth}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                onChange(id);
              }}
            >
              <option value="">— اختاري —</option>
              {level.map((c) => (
                <option key={c.id} value={c.id}>{c.name.ar}</option>
              ))}
            </select>
          );
        })}
      </div>
      {value != null && (() => {
        const cur = byId.get(value);
        if (!cur) return null;
        return <div className="muted" style={{ fontSize: 12 }}>القسم المختار: {path.map((p) => p.name.ar).join(" › ")}</div>;
      })()}
    </div>
  );
}
