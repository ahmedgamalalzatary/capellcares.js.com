"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getStore } from "@/lib/store";
import { showErrorToast } from "@/lib/errors";
import type { Category } from "@capella/shared";
import { BilingualNameFields, EditorActions } from "./editor-form-parts";
import { slugifyFormName } from "./form-slug";
import { ImageUpload } from "./image-upload";

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
  const [imagePath, setImagePath] = useState<string | null>(initial?.imagePath ?? null);
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
  const byId = useMemo(
    () => new Map(availableCategories.map((category) => [category.id, category])),
    [availableCategories]
  );
  const targetDepth = useMemo(() => {
    if (parentId == null) {
      return 0;
    }

    let depth = 1;
    let currentParentId = byId.get(parentId)?.parentId ?? null;
    const seen = new Set<number>([parentId]);
    while (currentParentId != null && !seen.has(currentParentId)) {
      seen.add(currentParentId);
      depth += 1;
      currentParentId = byId.get(currentParentId)?.parentId ?? null;
    }
    return depth;
  }, [byId, parentId]);
  const canUploadImage = targetDepth === 1;

  useEffect(() => {
    if (!canUploadImage && imagePath) {
      setImagePath(null);
    }
  }, [canUploadImage, imagePath]);

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
      imagePath: canUploadImage ? imagePath : null,
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
          <label htmlFor="category-parent">القسم الأب (اختياري)</label>
          <select id="category-parent" className="select" value={parentId ?? ""} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">— قسم رئيسي —</option>
            {parentOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          {selectedParentPath && <div className="muted selected-parent-path">المسار: {selectedParentPath}</div>}
        </div>
        {canUploadImage ? (
          <div className="field">
            <label>صورة القسم</label>
            <ImageUpload
              value={imagePath}
              onChange={setImagePath}
              uploadContext={mode === "new" ? "categories.create" : "categories.update"}
            />
          </div>
        ) : (
          <div className="muted">صورة القسم متاحة فقط للأقسام في المستوى الأول تحت القسم الرئيسي.</div>
        )}
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
