"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getStore } from "@/lib/store";
import type { Category } from "@capella/shared";

interface Props {
  mode: "new" | "edit";
  initial?: Category;
  categories: Category[];
}

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function CategoryForm({ mode, initial, categories }: Props) {
  const router = useRouter();
  const [nameAr, setNameAr] = useState(initial?.name.ar ?? "");
  const [nameEn, setNameEn] = useState(initial?.name.en ?? "");
  const [parentId, setParentId] = useState<number | null>(initial?.parentId ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const parents = categories.filter((c) => !c.deletedAt && c.id !== initial?.id);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!nameAr.trim()) e.nameAr = "مطلوب";
    if (!nameEn.trim()) e.nameEn = "مطلوب";
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const slug = initial?.slug ?? slugify(nameEn);
    const categoryPayload: Omit<Category, "id"> & { id?: number } = {
      id: initial?.id,
      slug,
      name: { ar: nameAr.trim(), en: nameEn.trim() },
      parentId,
      isLeaf: true,
      deletedAt: initial?.deletedAt ?? null
    };
    await getStore().upsertCategory(categoryPayload);
    router.push("/categories");
  };

  return (
    <div style={{ maxWidth: 640 }} className="card">
      <div className="card__head">
        <h3 className="card__title">{mode === "new" ? "إنشاء قسم جديد" : "تعديل القسم"}</h3>
      </div>
      <div className="card__body stack stack--lg">
        <div className="field">
          <label>الاسم بالعربية</label>
          <input className="input" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
          {errors.nameAr && <span className="field-error">{errors.nameAr}</span>}
        </div>
        <div className="field">
          <label>Name (English)</label>
          <input className="input" dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          {errors.nameEn && <span className="field-error">{errors.nameEn}</span>}
        </div>
        <div className="field">
          <label>القسم الأب (اختياري)</label>
          <select className="select" value={parentId ?? ""} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">— قسم رئيسي —</option>
            {parents.map((c) => <option key={c.id} value={c.id}>{c.name.ar}</option>)}
          </select>
        </div>
        <div className="editor-actions">
          <button className="btn btn--ghost" onClick={() => router.push("/categories")}>إلغاء</button>
          <button className="btn btn--primary" onClick={save}>{mode === "new" ? "إنشاء القسم" : "حفظ التعديلات"}</button>
        </div>
      </div>
    </div>
  );
}
