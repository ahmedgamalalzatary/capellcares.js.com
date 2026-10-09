"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ImagePlus, RefreshCw, Trash2, Upload } from "lucide-react";
import type { Category } from "@capella/shared";
import { StepCount, Stepper, type StepItem } from "@/components/admin/stepper";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { FileButton } from "@/components/ui/file-button";
import { Select } from "@/components/ui/input";
import { resolveMediaSrc } from "@/lib/media";
import { api, type ErpUploadContext } from "@/lib/api/client";
import { buildCategoryTreeOptions, getDescendantCategoryIds } from "@/lib/category-tree";
import { showErrorToast } from "@/lib/errors";
import { getStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { BilingualNameFields } from "@/components/forms/editor-form-parts";
import { slugifyFormName } from "@/lib/slug";

interface Props {
  mode: "new" | "edit";
  initial?: Category;
  categories: Category[];
}

const STEPS = [
  { id: "basics", label: "الأساسيات", title: "ما هو هذا القسم؟", description: "الاسم باللغتين، وموقعه في شجرة الأقسام." },
  { id: "image", label: "الصورة", title: "صورة القسم", description: "صورة اختيارية تظهر في قوائم المتجر للأقسام الفرعية المباشرة." }
] as const;

type StepId = (typeof STEPS)[number]["id"];

const FIELD_GRID = "grid gap-x-4 gap-y-5 @lg:grid-cols-2";

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
    <div className="grid w-fit max-w-full gap-2">
      <div className="flex flex-wrap items-center gap-4 rounded-well bg-sunken p-3">
        <div className="size-24 shrink-0">
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
      </div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function CategoryForm({ mode, initial, categories }: Props) {
  const router = useRouter();
  const editing = mode === "edit";
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(editing ? STEPS.length - 1 : 0);
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

  const stepIndex = (id: StepId) => STEPS.findIndex((candidate) => candidate.id === id);

  const requirements = useMemo(() => [
    { key: "nameAr", label: "الاسم بالعربية", target: "basics", ok: nameAr.trim().length > 0 },
    { key: "nameEn", label: "الاسم بالإنجليزية", target: "basics", ok: nameEn.trim().length > 0 }
  ], [nameAr, nameEn]);

  const checkRequirements = (keys: string[]) => {
    const failing = requirements.filter((requirement) => keys.includes(requirement.key) && !requirement.ok);
    setErrors((current) => {
      const next = { ...current };
      for (const key of keys) delete next[key];
      for (const requirement of failing) next[requirement.key] = requirement.key === "nameAr" ? "أدخلي الاسم بالعربية" : "أدخلي الاسم بالإنجليزية";
      return next;
    });
    return failing.length === 0;
  };

  const goTo = (index: number) => {
    setStep(index);
    setReached((current) => Math.max(current, index));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    const keys = requirements.filter((requirement) => requirement.target === STEPS[step]!.id).map((requirement) => requirement.key);
    if (!checkRequirements(keys)) return;
    goTo(step + 1);
  };

  const save = async () => {
    const nextErrors: Record<string, string> = {};
    if (!nameAr.trim()) nextErrors.nameAr = "أدخلي الاسم بالعربية";
    if (!nameEn.trim()) nextErrors.nameEn = "أدخلي الاسم بالإنجليزية";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      goTo(stepIndex("basics"));
      return;
    }
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

  const stepItems: StepItem[] = STEPS.map((item, index) => {
    const required = requirements.filter((requirement) => requirement.target === item.id);
    const unmet = required.some((requirement) => !requirement.ok);
    const seen = editing || index < step || index < reached;
    if (unmet) return { id: item.id, label: item.label, state: seen ? "missing" : "todo" };
    return { id: item.id, label: item.label, state: seen ? "done" : "todo" };
  });

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  const stepContent: Record<StepId, ReactNode> = {
    basics: (
      <div className="grid gap-5">
        <div className={FIELD_GRID}>
          <BilingualNameFields
            arValue={nameAr}
            enValue={nameEn}
            onArChange={setNameAr}
            onEnChange={setNameEn}
            arError={errors.nameAr}
            enError={errors.nameEn}
          />
        </div>
        <div className={FIELD_GRID}>
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
            <div data-testid="category-path" className="flex h-10 min-w-0 items-center gap-1.5 overflow-hidden rounded-control bg-sunken px-3 shadow-[inset_0_0_0_1px_var(--line)] pointer-coarse:h-11">
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
      </div>
    ),
    image: (
      <div className="grid gap-3">
        {canEditImage ? (
          <ImageWell value={imagePath} onChange={setImagePath} uploadContext={uploadContext} disabled={saving} />
        ) : (
          <Alert tone="info">صورة القسم متاحة فقط للأقسام الفرعية المباشرة تحت قسم رئيسي.</Alert>
        )}
      </div>
    )
  };

  return (
    <div className="grid gap-5">
      <Stepper steps={stepItems} current={step} isReachable={(index) => index <= reached} onSelect={goTo} />

      <Card>
        <CardHeader title={current.title} description={current.description} actions={<StepCount current={step} total={STEPS.length} />} />
        <CardBody className="@container">{stepContent[current.id]}</CardBody>
        <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4 sm:px-6">
          <Button variant="ghost" onClick={() => router.push("/categories")}>إلغاء</Button>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => goTo(step - 1)}>
                <ArrowRight /> السابق
              </Button>
            ) : null}
            {!isLast ? (
              <Button variant={editing ? "secondary" : "primary"} onClick={next}>
                التالي <ArrowLeft />
              </Button>
            ) : null}
            {editing || isLast ? (
              <Button variant="primary" disabled={saving} onClick={() => { void save(); }}>
                {saving ? "جارٍ الحفظ…" : editing ? "حفظ التعديلات" : "إنشاء القسم"}
              </Button>
            ) : null}
          </div>
        </footer>
      </Card>
    </div>
  );
}
