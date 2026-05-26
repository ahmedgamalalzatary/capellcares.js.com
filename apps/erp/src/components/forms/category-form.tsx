"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getStore } from "@/lib/store";
import { showErrorToast } from "@/lib/errors";
import type { Category } from "@capella/shared";
import { BilingualNameFields, EditorActions } from "./editor-form-parts";
import { slugifyFormName } from "./form-slug";

interface Props {
  mode: "new" | "edit";
  initial?: Category;
  categories: Category[];
}

export function CategoryForm({ mode, initial, categories }: Props) {
  const router = useRouter();
  const [nameAr, setNameAr] = useState(initial?.name.ar ?? "");
  const [nameEn, setNameEn] = useState(initial?.name.en ?? "");
  const [parentId, setParentId] = useState<number | null>(initial?.parentId ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const availableCategories = useMemo(
    () => categories.filter((c) => !c.deletedAt && c.id !== initial?.id),
    [categories, initial?.id]
  );
  const parentOptions = useMemo(() => {
    const byParent = new Map<number | null, Category[]>();
    for (const category of availableCategories) {
      const list = byParent.get(category.parentId) ?? [];
      list.push(category);
      byParent.set(category.parentId, list);
    }

    const flatten = (currentParentId: number | null, depth: number, path: Category[]): Array<{
      id: number;
      label: string;
      pathLabel: string;
    }> => {
      const items = (byParent.get(currentParentId) ?? []).slice().sort((a, b) => a.name.ar.localeCompare(b.name.ar, "ar"));
      return items.flatMap((category) => {
        const nextPath = [...path, category];
        const pathLabel = nextPath.map((item) => item.name.ar).join(" › ");
        const prefix = depth === 0 ? "" : `${"↳ ".repeat(depth)}`;
        const parentLabel = path.length > 0 ? ` (${path.map((item) => item.name.ar).join(" › ")})` : "";

        return [
          {
            id: category.id,
            label: `${prefix}${category.name.ar}${parentLabel}`,
            pathLabel
          },
          ...flatten(category.id, depth + 1, nextPath)
        ];
      });
    };

    return flatten(null, 0, []);
  }, [availableCategories]);
  const selectedParentPath = useMemo(
    () => parentOptions.find((option) => option.id === parentId)?.pathLabel ?? null,
    [parentId, parentOptions]
  );

  const save = async () => {
    const e: Record<string, string> = {};
    if (!nameAr.trim()) e.nameAr = "مطلوب";
    if (!nameEn.trim()) e.nameEn = "مطلوب";
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const slug = initial?.slug ?? slugifyFormName(nameEn);
    const categoryPayload: Omit<Category, "id"> & { id?: number } = {
      id: initial?.id,
      slug,
      name: { ar: nameAr.trim(), en: nameEn.trim() },
      parentId,
      isLeaf: true,
      deletedAt: initial?.deletedAt ?? null
    };
    try {
      await getStore().upsertCategory(categoryPayload);
      router.push("/categories");
    } catch (error) {
      showErrorToast(error);
    }
  };

  return (
    <div style={{ maxWidth: 640 }} className="card">
      <div className="card__head">
        <h3 className="card__title">{mode === "new" ? "إنشاء قسم جديد" : "تعديل القسم"}</h3>
      </div>
      <div className="card__body stack stack--lg">
        <BilingualNameFields
          arValue={nameAr}
          enValue={nameEn}
          onArChange={setNameAr}
          onEnChange={setNameEn}
          arError={errors.nameAr}
          enError={errors.nameEn}
        />
        <div className="field">
          <label>القسم الأب (اختياري)</label>
          <select className="select" value={parentId ?? ""} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">— قسم رئيسي —</option>
            {parentOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          {selectedParentPath && <div className="muted selected-parent-path">المسار: {selectedParentPath}</div>}
        </div>
        <EditorActions
          cancelLabel="إلغاء"
          saveLabel={mode === "new" ? "إنشاء القسم" : "حفظ التعديلات"}
          onCancel={() => router.push("/categories")}
          onSave={() => {
            void save();
          }}
        />
      </div>
    </div>
  );
}
