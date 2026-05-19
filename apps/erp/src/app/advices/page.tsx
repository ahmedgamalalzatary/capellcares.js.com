"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/shell/admin-shell";
import { getStore, useStore } from "@/lib/store";
import { ImageUpload } from "@/components/forms/image-upload";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/ui/icons";
import type { Advice } from "@capella/shared";

type AdviceDraft = {
  title: { ar: string; en: string };
  description: { ar: string; en: string };
  imagePath: string;
  videoUrl: string;
  status: "active" | "inactive";
  sortOrder: number;
};

const emptyAdvice: AdviceDraft = {
  title: { ar: "", en: "" },
  description: { ar: "", en: "" },
  imagePath: "",
  videoUrl: "",
  status: "inactive",
  sortOrder: 0
};

export default function AdvicesPage() {
  const advices = useStore((s) => s.advices);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Advice | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<Advice | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return advices;
    const term = search.trim().toLowerCase();
    return advices.filter((advice) =>
      advice.title.ar.toLowerCase().includes(term) ||
      advice.title.en.toLowerCase().includes(term)
    );
  }, [advices, search]);

  return (
    <AdminShell
      title="نصائح كابيلا"
      crumbs={[{ label: "نصائح كابيلا" }]}
      actions={
        <button className="btn btn--primary btn--sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Icon.Plus /> نصيحة جديدة
        </button>
      }
    >
      <div className="toolbar">
        <div className="search">
          <Icon.Search />
          <input placeholder="ابحثي عن نصيحة…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ marginInlineStart: "auto" }} className="muted">{filtered.length} نصيحة</div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
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
                  <div style={{ fontWeight: 600 }}>{advice.title.ar}</div>
                  <div className="faint" style={{ fontSize: 11 }}>{advice.title.en}</div>
                </td>
                <td className="muted" style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>
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
                    <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(advice); setOpen(true); }}>
                      <Icon.Edit />
                    </button>
                    <button className="btn btn--ghost btn--sm" style={{ color: "var(--danger)" }} onClick={() => void getStore().deleteAdvice(advice.id)}>
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

      <AdviceModal open={open} initial={editing ?? undefined} onClose={() => setOpen(false)} />
      <Modal
        open={pendingToggle != null}
        title={pendingToggle?.status === "active" ? "تأكيد الإيقاف" : "تأكيد التفعيل"}
        onClose={() => setPendingToggle(null)}
        footer={(
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
        )}
      >
        <p style={{ margin: 0 }}>
          {pendingToggle?.status === "active"
            ? "سيتم إيقاف هذه النصيحة ولن تظهر في المتجر. هل تريدين المتابعة؟"
            : "سيتم تفعيل هذه النصيحة لتظهر في المتجر. هل تريدين المتابعة؟"}
        </p>
      </Modal>
    </AdminShell>
  );
}

function AdviceModal({ open, initial, onClose }: { open: boolean; initial?: Advice; onClose: () => void }) {
  const [form, setForm] = useState<AdviceDraft>(emptyAdvice);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? {
      title: initial.title,
      description: initial.description,
      imagePath: initial.imagePath,
      videoUrl: initial.videoUrl ?? "",
      status: initial.status,
      sortOrder: initial.sortOrder
    } : emptyAdvice);
  }, [initial, open]);

  return (
    <Modal
      open={open}
      title={initial ? "تعديل النصيحة" : "نصيحة جديدة"}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>إلغاء</button>
          <button
            className="btn btn--primary btn--sm"
            onClick={async () => {
              await getStore().upsertAdvice({ id: initial?.id, ...form });
              onClose();
            }}
          >
            حفظ
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        <input className="input" placeholder="العنوان بالعربية" value={form.title.ar} onChange={(e) => setForm((prev) => ({ ...prev, title: { ...prev.title, ar: e.target.value } }))} />
        <input className="input" placeholder="Title in English" value={form.title.en} onChange={(e) => setForm((prev) => ({ ...prev, title: { ...prev.title, en: e.target.value } }))} />
        <textarea className="input" rows={4} placeholder="الوصف بالعربية" value={form.description.ar} onChange={(e) => setForm((prev) => ({ ...prev, description: { ...prev.description, ar: e.target.value } }))} />
        <textarea className="input" rows={4} placeholder="Description in English" value={form.description.en} onChange={(e) => setForm((prev) => ({ ...prev, description: { ...prev.description, en: e.target.value } }))} />
        <ImageUpload value={form.imagePath || null} onChange={(value) => setForm((prev) => ({ ...prev, imagePath: value ?? "" }))} />
        <input className="input" placeholder="رابط يوتيوب أو إنستجرام" value={form.videoUrl} onChange={(e) => setForm((prev) => ({ ...prev, videoUrl: e.target.value }))} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <select className="select" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as "active" | "inactive" }))}>
            <option value="inactive">غير نشط</option>
            <option value="active">نشط</option>
          </select>
          <input className="input" type="number" value={form.sortOrder} onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: Number(e.target.value) }))} />
        </div>
      </div>
    </Modal>
  );
}
