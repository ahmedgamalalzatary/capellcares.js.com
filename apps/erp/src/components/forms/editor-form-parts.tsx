"use client";

import { useId, type ChangeEvent } from "react";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const LANG_TAG = { ar: "ع", en: "EN" } as const;

interface LocalizedTextFieldProps {
  lang: "ar" | "en";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  invalid?: boolean;
  id?: string;
  ariaLabel?: string;
}

/** One language of a bilingual value; a small corner tag names the language once the placeholder is gone. */
function LocalizedTextField({ lang, value, onChange, placeholder, multiline = false, invalid, id, ariaLabel }: LocalizedTextFieldProps) {
  const common = {
    id,
    value,
    lang,
    dir: lang === "en" ? ("ltr" as const) : undefined,
    placeholder,
    "aria-label": ariaLabel,
    "aria-invalid": invalid || undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  };

  return (
    <span className="relative flex min-w-0">
      {multiline ? <Textarea className="pb-8" {...common} /> : <Input className="pe-11" {...common} />}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute rounded-sm bg-sand-150 px-1.5 text-xs font-medium leading-5 text-text-muted",
          // Pinned to the control's own inline end (English fields run left-to-right).
          lang === "en" ? "right-2.5" : "left-2.5",
          multiline ? "bottom-2.5" : "top-1/2 -translate-y-1/2",
        )}
      >
        {LANG_TAG[lang]}
      </span>
    </span>
  );
}

interface BilingualEditorFieldProps {
  label: string;
  arValue: string;
  enValue: string;
  onArChange: (value: string) => void;
  onEnChange: (value: string) => void;
  multiline?: boolean;
}

export function BilingualEditorField({ label, arValue, enValue, onArChange, onEnChange, multiline = false }: BilingualEditorFieldProps) {
  return (
    <fieldset className="@container grid min-w-0 gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-text-2">{label}</legend>
      <div className="grid gap-x-4 gap-y-3 @lg:grid-cols-2">
        <LocalizedTextField lang="ar" value={arValue} onChange={onArChange} placeholder="بالعربية" ariaLabel={`${label} بالعربية`} multiline={multiline} />
        <LocalizedTextField lang="en" value={enValue} onChange={onEnChange} placeholder="In English" ariaLabel={`${label} بالإنجليزية`} multiline={multiline} />
      </div>
    </fieldset>
  );
}

interface BilingualNameFieldsProps {
  arValue: string;
  enValue: string;
  onArChange: (value: string) => void;
  onEnChange: (value: string) => void;
  arError?: string;
  enError?: string;
}

/** Two grid cells (Arabic, English); the caller's grid lays them out. */
export function BilingualNameFields({ arValue, enValue, onArChange, onEnChange, arError, enError }: BilingualNameFieldsProps) {
  const arId = useId();
  const enId = useId();
  return (
    <>
      <Field label="الاسم بالعربية" htmlFor={arId} error={arError}>
        <LocalizedTextField lang="ar" id={arId} value={arValue} onChange={onArChange} invalid={Boolean(arError)} />
      </Field>
      <Field label="الاسم بالإنجليزية" htmlFor={enId} error={enError}>
        <LocalizedTextField lang="en" id={enId} value={enValue} onChange={onEnChange} invalid={Boolean(enError)} />
      </Field>
    </>
  );
}
