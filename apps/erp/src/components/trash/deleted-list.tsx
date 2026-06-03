"use client";

import { Icon } from "@/components/ui/icons";
import type { TrashListRow } from "../../types/trash-page.types";

export function DeletedList({
  rows,
  onRestore,
  onHardDelete,
  empty
}: {
  rows: TrashListRow[];
  onRestore?: (id: number) => void;
  onHardDelete?: (id: number, title: string) => void;
  empty: string;
}) {
  if (rows.length === 0) {
    return <div style={{ padding: 60, textAlign: "center", color: "var(--ink-3)" }}>{empty}</div>;
  }

  return (
    <div className="table-outer">
      <table className="table">
        <thead>
          <tr>
            <th>العنصر</th>
            <th>تاريخ الحذف</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <div style={{ fontWeight: 600 }}>{row.title}</div>
                <div className="faint" style={{ fontSize: 11 }}>{row.subtitle}</div>
              </td>
              <td className="muted">{row.meta}</td>
              <td>
                <div style={{ display: "inline-flex", gap: 8 }}>
                  {onRestore && (
                    <button className="btn btn--ghost btn--sm" onClick={() => onRestore(row.id)}>
                      <Icon.Check /> استعادة
                    </button>
                  )}
                  {onHardDelete && (
                    <button
                      className="btn btn--ghost btn--sm"
                      style={{ color: "var(--danger, #c0392b)" }}
                      onClick={() => onHardDelete(row.id, row.title)}
                    >
                      <Icon.Trash /> حذف نهائي
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
