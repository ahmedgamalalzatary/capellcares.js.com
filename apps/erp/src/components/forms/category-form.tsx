"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { ChevronLeft, ImagePlus, RefreshCw, Trash2, Upload } from "lucide-react";
import type { Category } from "@capella/shared";
import { EditorLayout } from "@/components/admin/editor-layout";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { FileButton } from "@/components/ui/file-button";
import { Select } from "@/components/ui/input";
import { resolveMediaSrc } from "@/components/ui/thumb";
import { api, type ErpUploadContext } from "@/lib/api/client";
import { buildCategoryTreeOptions, getDescendantCategoryIds } from "@/lib/category-tree";
import { showErrorToast } from "@/lib/errors";
import { getStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { BilingualNameFields } from "./editor-form-parts";
import { slugifyFormName } from "./form-slug";

interface Props {
  mode: "new" | "edit";
  initial?: Category;
  categories: Category[];
}

function ImageWell({
  value,
  onChange,
  uploadContext,
  disabled
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  uploadContext: ErpUploadContext;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("نوع الصورة غير مدعوم. استخدمي PNG أو JPG أو WEBP.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("حجم الصورة أكبر من 4 ميجابايت.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.uploadImage(file, uploadContext);
      onChange(result.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "تعذر رفع الصورة.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-well bg-sunken p-3">
      <div className="size-28 shrink-0">
        {value ? (
          <img src={resolveMediaSrc(value)} alt="" className="size-full rounded-thumb object-cover" />
        ) : (
          <div className="grid size-full place-items-center rounded-thumb border border-dashed border-line-strong text-text-muted">
            <ImagePlus aria-hidden className="size-5" />
          </div>
        )}
      </div>
      <div className="grid min-w-0 gap-1">
        <span className="text-base font-medium text-text-strong">{value ? "الصورة مضافة" : "لا توجد صورة"}</span>
        <span className="text-xs text-text-muted">PNG أو JPG أو WEBP — حتى 4 ميجابايت.</span>
        <div className="mt-1 flex items-center gap-1">
          <FileButton
            accept="image/png,image/jpeg,image/webp"
            disabled={disabled || busy}
            onChange={(event) => { void handleFiles(event.target.files); event.target.value = ""; }}
          >
            {value ? <RefreshCw /> : <Upload />}
            {value ? "استبدال الصورة" : "رفع صورة"}
          </FileButton>
          {value ? (
            <Button variant="danger-ghost" size="icon-sm" aria-label="إزالة الصورة" disabled={busy} onClick={() => onChange(null)}>
              <Trash2 />
            </Button>
          ) : null}
        </div>
      </div>
      {error ? <p role="alert" className="w-full text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function CategoryForm({ mode, initial, categories }: Props) {
  const router = useRouter();
  const [nameAr, setNameAr] = useState(initial?.name.ar ?? "");
  const [nameEn, setNameEn] = useState(initial?.name.en ?? "");
  const [parentId, setParentId] = useState<number | null>(initial?.parentId ?? null);
  const [imagePath, setImagePath] = useState(initial?.imagePath ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const availableCategories = useMemo(() => {
    const excluded = initial ? getDescendantCategoryIds(categories, initial.id) : new Set<number>([-1]);
    return categories.filter((category) => !category.deletedAt && !excluded.has(category.id));
  }, [categories, initial]);

  const parentOptions = useMemo(() => buildCategoryTreeOptions(availableCategories), [availableCategories]);
  const selectedPath = useMemo(() => {
    const byId = new Map(availableCategories.map((category) => [category.id, category]));
    const segments: string[] = [];
    let currentId = parentId;
    const guard = new Set<number>();
    while (currentId != null && !guard.has(currentId)) {
      guard.add(currentId);
      const current = byId.get(currentId);
      if (!current) break;
      segments.unshift(current.name.ar);
      currentId = current.parentId;
    }
    return segments;
  }, [availableCategories, parentId]);

  const selectedDepth = selectedPath.length;
  const canEditImage = selectedDepth === 1;
  const uploadContext: ErpUploadContext = mode === "edit" ? "categories.update" : "categories.create";

  const save = async () => {
    const next: Record<string, string> = {};
    if (!nameAr.trim()) next.nameAr = "أدخلي الاسم بالعربية";
    if (!nameEn.trim()) next.nameEn = "أدخلي الاسم بالإنجليزية";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await getStore().upsertCategory({
        id: initial?.id,
        slug: initial?.slug ?? slugifyFormName(nameEn),
        name: { ar: nameAr.trim(), en: nameEn.trim() },
        parentId,
        imagePath: canEditImage ? imagePath : null,
        isLeaf: true,
        deletedAt: initial?.deletedAt ?? null
      });
      router.push("/categories");
    } catch (error) {
      showErrorToast(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <EditorLayout
      main={
        <Card>
          <CardHeader
            title="القسم"
            description={mode === "new" ? "أضيفي اسمًا بالعربية والإنجليزية، وحدّدي موقعه في الشجرة." : "حدّثي بيانات القسم وموقعه في الشجرة."}
          />
          <CardBody className="@container">
            <div className="grid gap-x-4 gap-y-5 @lg:grid-cols-2">
              <BilingualNameFields
                arValue={nameAr}
                enValue={nameEn}
                onArChange={setNameAr}
                onEnChange={setNameEn}
                arError={errors.nameAr}
                enError={errors.nameEn}
              />
              <Field label="القسم الأب (اختياري)" htmlFor="category-parent" hint="اتركيه فارغًا ليكون قسمًا رئيسيًا.">
                <Select
                  id="category-parent"
                  value={parentId ?? ""}
                  onChange={(event) => setParentId(event.target.value ? Number(event.target.value) : null)}
                >
                  <option value="">— قسم رئيسي —</option>
                  {parentOptions.map((option) => (
                    <option key={option.id} value={option.id}>{`${"— ".repeat(option.depth)}${option.label}`}</option>
                  ))}
                </Select>
              </Field>

              <Field label="الموقع في الشجرة">
                <div className="flex h-10 min-w-0 items-center gap-1.5 overflow-hidden rounded-control bg-sunken px-3 shadow-[inset_0_0_0_1px_var(--line)] pointer-coarse:h-11">
                  {selectedPath.length === 0 ? (
                    <span className="text-sm text-text-muted">قسم رئيسي</span>
                  ) : (
                    selectedPath.map((segment, index) => (
                      <Fragment key={`${segment}-${index}`}>
                        {index > 0 ? <ChevronLeft aria-hidden className="size-3.5 shrink-0 text-icon-faint" /> : null}
                        <span className={cn("truncate text-sm", index === selectedPath.length - 1 ? "font-medium text-text-strong" : "text-text-2")}>
                          {segment}
                        </span>
                      </Fragment>
                    ))
                  )}
                </div>
              </Field>
            </div>

            <section className="mt-6 grid gap-3 border-t border-line pt-5">
              <div>
                <h3 className="text-base font-bold text-text-strong">صورة القسم</h3>
                <p className="text-sm text-text-muted">تُعرض هذه الصورة في قوائم المتجر للأقسام الفرعية المباشرة. اختيارية.</p>
              </div>
              {canEditImage ? (
                <ImageWell value={imagePath} onChange={setImagePath} uploadContext={uploadContext} disabled={saving} />
              ) : (
                <Alert tone="info">صورة القسم متاحة فقط للأقسام الفرعية المباشرة تحت قسم رئيسي.</Alert>
              )}
            </section>
          </CardBody>
        </Card>
      }
      actions={
        <>
          <Button variant="ghost" onClick={() => router.push("/categories")}>إلغاء</Button>
          <Button variant="primary" disabled={saving} onClick={() => { void save(); }}>
            {saving ? "جارٍ الحفظ…" : mode === "new" ? "إنشاء القسم" : "حفظ التعديلات"}
          </Button>
        </>
      }
    />
  );
}
