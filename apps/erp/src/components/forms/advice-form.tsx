"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getStore } from "@/lib/store";
import { ImageUpload } from "@/components/forms/image-upload";
import type { Advice } from "@capella/shared";

type AdviceDraft = {
  title: { ar: string; en: string };
  description: { ar: string; en: string };
  imagePath: string;
  videoUrl: string;
  status: "active" | "inactive";
  sortOrder: number;
};

const empty: AdviceDraft = {
  title: { ar: "", en: "" },
  description: { ar: "", en: "" },
  imagePath: "",
  videoUrl: "",
  status: "inactive",
  sortOrder: 0,
};

interface Props {
  mode: "new" | "edit";
  initial?: Advice;
}

export function AdviceForm({ mode, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<AdviceDraft>(
    initial
      ? {
          title: initial.title,
          description: initial.description,
          imagePath: initial.imagePath ?? "",
          videoUrl: initial.videoUrl ?? "",
          status: initial.status,
          sortOrder: initial.sortOrder,
        }
      : empty
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof AdviceDraft>(key: K, value: AdviceDraft[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.title.ar.trim()) { setError("العنوان بالعربية مطلوب."); return; }
    try {
      setSaving(true);
      setError(null);
      await getStore().upsertAdvice({ id: initial?.id, ...form });
      router.push("/advices");
    } catch {
      setError("حدث خطأ أثناء الحفظ. حاولي مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor-grid">
      <div className="card">
        <div className="card__head">
          <h3 className="card__title">بيانات النصيحة</h3>
        </div>
        <div className="card__body form-stack">
          <div className="editor-fields-2">
            <div className="field">
              <label>العنوان بالعربية</label>
              <input
                className="input"
                placeholder="عنوان النصيحة"
                value={form.title.ar}
                onChange={(e) => set("title", { ...form.title, ar: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Title in English</label>
              <input
                className="input"
                placeholder="Advice title"
                value={form.title.en}
                onChange={(e) => set("title", { ...form.title, en: e.target.value })}
              />
            </div>
          </div>

          <div className="editor-fields-2">
            <div className="field">
              <label>الوصف بالعربية</label>
              <textarea
                className="textarea"
                rows={4}
                placeholder="وصف النصيحة"
                value={form.description.ar}
                onChange={(e) => set("description", { ...form.description, ar: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Description in English</label>
              <textarea
                className="textarea"
                rows={4}
                placeholder="Advice description"
                value={form.description.en}
                onChange={(e) => set("description", { ...form.description, en: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label>رابط يوتيوب أو إنستجرام</label>
            <input
              className="input"
              placeholder="https://…"
              value={form.videoUrl}
              onChange={(e) => set("videoUrl", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
        <div className="card">
          <div className="card__head"><h3 className="card__title">الصورة</h3></div>
          <div className="card__body">
            <ImageUpload
              value={form.imagePath || null}
              onChange={(v) => set("imagePath", v ?? "")}
            />
          </div>
        </div>

        <div className="card">
          <div className="card__head"><h3 className="card__title">الإعدادات</h3></div>
          <div className="card__body form-stack">
            <div className="field">
              <label>الحالة</label>
              <select
                className="select"
                value={form.status}
                onChange={(e) => set("status", e.target.value as "active" | "inactive")}
              >
                <option value="inactive">غير نشط</option>
                <option value="active">نشط</option>
              </select>
            </div>
            <div className="field">
              <label>الترتيب</label>
              <input
                className="input"
                type="number"
                value={form.sortOrder}
                onChange={(e) => set("sortOrder", Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {error && <p style={{ margin: 0, color: "var(--error)", fontSize: 13 }}>{error}</p>}

        <div className="editor-actions">
          <button className="btn btn--ghost" onClick={() => router.push("/advices")} disabled={saving}>
            إلغاء
          </button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? "جارٍ الحفظ…" : mode === "new" ? "إضافة النصيحة" : "حفظ التغييرات"}
          </button>
        </div>
      </div>
    </div>
  );
}
