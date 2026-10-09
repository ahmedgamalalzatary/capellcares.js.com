"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Advice } from "@capella/shared";
import { StepCount, Stepper } from "@/components/admin/stepper";
import { useWizardSteps } from "@/hooks/use-wizard-steps";
import { Swatch } from "@/components/ui/badge";
import { StatusChoice } from "@/components/forms/status-choice";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { BilingualEditorField, BilingualNameFields } from "@/components/forms/editor-form-parts";

interface Props {
  mode: "new" | "edit";
  initial?: Advice;
}

type AdviceDraft = {
  title: { ar: string; en: string };
  description: { ar: string; en: string };
  videoUrl: string;
  status: "active" | "inactive";
};

const STEPS = [
  { id: "basics", label: "الأساسيات", title: "ما هي هذه النصيحة؟", description: "العنوان والوصف باللغتين." },
  { id: "publish", label: "الفيديو والنشر", title: "الفيديو والنشر", description: "رابط الفيديو وحالة ظهور النصيحة." }
] as const;

type StepId = (typeof STEPS)[number]["id"];

const STATUS_OPTIONS = [
  { value: "inactive", label: "مسودة", hint: "مخفية عن المتجر", tone: "neutral" },
  { value: "active", label: "نشطة", hint: "تظهر في المتجر", tone: "success" }
] as const;

const FIELD_GRID = "grid gap-x-4 gap-y-5 @lg:grid-cols-2";

export function AdviceForm({ mode, initial }: Props) {
  const router = useRouter();
  const editing = mode === "edit";
  const [form, setForm] = useState<AdviceDraft>(
    initial
      ? { title: initial.title, description: initial.description, videoUrl: initial.videoUrl, status: initial.status }
      : { title: { ar: "", en: "" }, description: { ar: "", en: "" }, videoUrl: "", status: "inactive" }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof AdviceDraft>(key: K, value: AdviceDraft[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const requirements = [
    { key: "titleAr", label: "العنوان بالعربية", target: "basics", ok: form.title.ar.trim().length > 0 },
    { key: "videoUrl", label: "رابط الفيديو", target: "publish", ok: form.videoUrl.trim().length > 0 }
  ];

  const checkRequirements = (keys: string[]) => {
    const failing = requirements.filter((requirement) => keys.includes(requirement.key) && !requirement.ok);
    setErrors((current) => {
      const next = { ...current };
      for (const key of keys) delete next[key];
      for (const requirement of failing) next[requirement.key] = requirement.key === "titleAr" ? "أدخلي العنوان بالعربية" : "أدخلي رابط الفيديو";
      return next;
    });
    return failing.length === 0;
  };

  const { step, current, goTo, next, stepIndex, stepItems, reached } = useWizardSteps({
    steps: STEPS,
    requirements,
    editing,
    checkRequirements
  });

  const submit = async (asStatus?: "inactive") => {
    const draft = asStatus ? { ...form, status: asStatus } : form;
    setForm(draft);
    const nextErrors: Record<string, string> = {};
    if (!draft.title.ar.trim()) nextErrors.titleAr = "أدخلي العنوان بالعربية";
    if (!asStatus && !draft.videoUrl.trim()) nextErrors.videoUrl = "أدخلي رابط الفيديو";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      goTo(!draft.title.ar.trim() ? stepIndex("basics") : stepIndex("publish"));
      return;
    }
    setSaving(true);
    try {
      await getStore().upsertAdvice({ id: initial?.id, ...draft });
      router.push("/advices");
    } catch {
      setErrors({ form: "حدث خطأ أثناء الحفظ. حاولي مرة أخرى." });
    } finally {
      setSaving(false);
    }
  };

  const isLast = step === STEPS.length - 1;
  const missing = requirements.filter((requirement) => !requirement.ok);
  const canPublish = missing.length === 0;
  const primaryLabel = editing ? "حفظ التعديلات" : form.status === "active" ? "نشر النصيحة" : "حفظ النصيحة";

  const stepContent: Record<StepId, ReactNode> = {
    basics: (
      <div className="grid gap-5">
        <div className={FIELD_GRID}>
          <BilingualNameFields
            arValue={form.title.ar}
            enValue={form.title.en}
            onArChange={(value) => set("title", { ...form.title, ar: value })}
            onEnChange={(value) => set("title", { ...form.title, en: value })}
            arError={errors.titleAr}
          />
        </div>
        <BilingualEditorField
          label="الوصف"
          arValue={form.description.ar}
          onArChange={(value) => set("description", { ...form.description, ar: value })}
          enValue={form.description.en}
          onEnChange={(value) => set("description", { ...form.description, en: value })}
          multiline
        />
      </div>
    ),
    publish: (
      <div className="grid gap-5">
        <Field
          label="رابط الفيديو"
          htmlFor="advice-video-url"
          hint="يوتيوب أو إنستجرام."
          error={errors.videoUrl}
        >
          <Input
            id="advice-video-url"
            dir="ltr"
            inputMode="url"
            placeholder="https://…"
            aria-invalid={Boolean(errors.videoUrl) || undefined}
            value={form.videoUrl}
            onChange={(event) => set("videoUrl", event.target.value)}
          />
        </Field>

        <div className={cn(FIELD_GRID, "border-t border-line pt-5")}>
          <section className="grid content-start gap-4">
            <div>
              <h3 className="text-base font-bold text-text-strong">حالة النصيحة</h3>
              <p className="text-sm text-text-muted">المسودة مخفية عن المتجر حتى تنشريها.</p>
            </div>
            <StatusChoice name="advice-status" value={form.status} onChange={(value) => set("status", value)} legend="حالة النصيحة" options={STATUS_OPTIONS} />
            {canPublish ? (
              <p className="flex items-center gap-2 text-sm text-text-2">
                <Swatch tone="success" /> كل بيانات النشر مكتملة.
              </p>
            ) : (
              <div className="grid gap-1.5">
                <p className="text-sm text-text-2">مطلوب قبل النشر:</p>
                <ul className="flex flex-wrap gap-1.5">
                  {missing.map((requirement) => (
                    <li key={requirement.key}>
                      <button
                        type="button"
                        onClick={() => goTo(stepIndex(requirement.target as StepId))}
                        className="inline-flex h-7 items-center rounded-full bg-warning-soft px-2.5 text-xs font-medium text-warning transition-colors hover:bg-warning-soft/70 pointer-coarse:h-9"
                      >
                        {requirement.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
          <div />
        </div>
        {errors.form ? <p role="alert" className="text-sm text-danger">{errors.form}</p> : null}
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
          <Button variant="ghost" onClick={() => router.push("/advices")}>إلغاء</Button>
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
            {!editing && !isLast ? (
              <Button variant="ghost" className="underline underline-offset-4" disabled={saving} onClick={() => { void submit("inactive"); }}>
                حفظ كمسودة
              </Button>
            ) : null}
            {editing || isLast ? (
              <Button variant="primary" disabled={saving} onClick={() => { void submit(); }}>
                {saving ? "جارٍ الحفظ…" : primaryLabel}
              </Button>
            ) : null}
          </div>
        </footer>
      </Card>
    </div>
  );
}
