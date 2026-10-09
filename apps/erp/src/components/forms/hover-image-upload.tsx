"use client";

import { useState } from "react";
import type { Language } from "@capella/shared";
import { Alert } from "@/components/ui/alert";
import { api, type ErpUploadContext } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/errors";
import { resolveMediaSrc, validateImageFile } from "@/lib/media";
import { LangSlotRow } from "./media-frame";

interface Props {
  arValue: string;
  enValue: string;
  onChange: (lang: Language, value: string) => void;
  uploadContext?: ErpUploadContext;
  entityLabel?: string;
  testIdPrefix?: "product" | "offer" | "collection";
}

export function HoverImageUpload({
  arValue,
  enValue,
  onChange,
  uploadContext,
  entityLabel = "منتج",
  testIdPrefix = "product"
}: Props) {
  const [uploading, setUploading] = useState<Language | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (lang: Language, files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!uploadContext) {
      setError("رفع صورة التمرير متاح فقط داخل مسارات التعديل المصرح بها.");
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(lang);
    setError(null);
    try {
      const result = await api.uploadImage(file, uploadContext);
      onChange(lang, result.url);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, "تعذر رفع صورة التمرير"));
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="@container grid gap-3">
      <div className="grid gap-4 @lg:grid-cols-2">
        {(["ar", "en"] as const).map((lang) => {
          const value = lang === "ar" ? arValue : enValue;
          return (
            <LangSlotRow
              key={lang}
              lang={lang}
              title={lang === "ar" ? "الصورة العربية" : "الصورة الإنجليزية"}
              src={value ? resolveMediaSrc(value) : null}
              inputTestId={`${testIdPrefix}-hover-image-${lang}-input`}
              canUpload={uploading === null && Boolean(uploadContext)}
              busy={uploading !== null}
              onFiles={(files) => { void handleFile(lang, files); }}
              onRemove={() => onChange(lang, "")}
              removeLabel={`إزالة صورة التمرير ${lang === "ar" ? "العربية" : "الإنجليزية"}`}
            />
          );
        })}
      </div>
      {!uploadContext ? <p className="text-sm text-text-muted">رفع صور التمرير متاح فقط أثناء تعديل {entityLabel} موجود.</p> : null}
      {uploading ? <p role="status" className="text-sm text-text-muted">جارٍ رفع الصورة…</p> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
