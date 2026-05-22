"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/shell/admin-shell";
import { getStore, useStore } from "@/lib/store";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icons";
import type { Advice } from "@capella/shared";

export default function AdvicesPage() {
  const advices = useStore((s) => s.advices);
  const [search, setSearch] = useState("");
  const [pendingToggle, setPendingToggle] = useState<Advice | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Advice | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return advices;
    const term = search.trim().toLowerCase();
    return advices.filter((a) =>
      a.title.ar.toLowerCase().includes(term) ||
      a.title.en.toLowerCase().includes(term)
    );
  }, [advices, search]);

  return (
    <AdminShell
      title="نصائح كابيلا"
      crumbs={[{ label: "نصائح كابيلا" }]}
      actions={
        <Link href="/advices/new" className="btn btn--primary btn--sm">
          <Icon.Plus /> نصيحة جديدة
        </Link>
      }
    >
      <div className="toolbar">
        <div className="search">
          <Icon.Search />
          <input placeholder="ابحثي عن نصيحة…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ marginInlineStart: "auto" }} className="muted">{filtered.length} نصيحة</div>
      </div>

      <div className="card">
        <div className="table-outer">
          <table className="table">
            <thead>
              <tr>
                <th>العنوان</th>
                <th>الرابط</th>
                <th>الترتيب</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((advice) => (
                <tr key={advice.id}>
                  <td>
                    <Link href={`/advices/${advice.id}/edit`} className="table-title">{advice.title.ar}</Link>
                    <div className="table-subtitle">{advice.title.en}</div>
                  </td>
                  <td className="muted" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {advice.videoUrl || "—"}
                  </td>
                  <td>{advice.sortOrder}</td>
                  <td>
                    {advice.status === "active"
                      ? <span className="status status--active">نشط</span>
                      : <span className="status status--inactive">غير نشط</span>}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => setPendingToggle(advice)}
                        title={advice.status === "active" ? "إيقاف" : "تفعيل"}
                      >
                        {advice.status === "active" ? <Icon.X /> : <Icon.Check />}
                      </button>
                      <Link href={`/advices/${advice.id}/edit`} className="btn btn--ghost btn--sm">
                        <Icon.Edit />
                      </Link>
                      <button
                        className="btn btn--ghost btn--sm"
                        style={{ color: "var(--danger)" }}
                        onClick={() => setPendingDelete(advice)}
                      >
                        <Icon.Trash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>لا توجد نصائح بعد.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={pendingToggle != null}
        title={pendingToggle?.status === "active" ? "تأكيد الإيقاف" : "تأكيد التفعيل"}
        onClose={() => setPendingToggle(null)}
        footer={
          <>
            <button className="btn btn--ghost btn--sm" onClick={() => setPendingToggle(null)}>إلغاء</button>
            <button
              className="btn btn--primary btn--sm"
              onClick={async () => {
                if (!pendingToggle) return;
                await getStore().toggleAdviceStatus(pendingToggle.id);
                setPendingToggle(null);
              }}
            >
              تأكيد
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          {pendingToggle?.status === "active"
            ? "سيتم إيقاف هذه النصيحة ولن تظهر في المتجر. هل تريدين المتابعة؟"
            : "سيتم تفعيل هذه النصيحة لتظهر في المتجر. هل تريدين المتابعة؟"}
        </p>
      </Modal>

      <Modal
        open={pendingDelete != null}
        title="تأكيد الحذف"
        onClose={() => setPendingDelete(null)}
        footer={
          <>
            <button className="btn btn--ghost btn--sm" onClick={() => setPendingDelete(null)}>إلغاء</button>
            <button
              className="btn btn--danger btn--sm"
              onClick={() => {
                if (!pendingDelete) return;
                void getStore().deleteAdvice(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              حذف
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>سيتم حذف هذه النصيحة نهائيًا. هل تريدين المتابعة؟</p>
      </Modal>
    </AdminShell>
  );
}
