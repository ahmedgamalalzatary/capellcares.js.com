"use client";

import { LangSlotRow } from "@/components/forms/media-frame";
import { useImageUpload } from "@/hooks/use-image-upload";
import { resolveMediaSrc } from "@/lib/media";
import type { ErpUploadContext } from "@/lib/api/client";

/** One language's picture as a compact horizontal row (thumbnail beside its name and actions), so an Arabic | English pair fits side by side. */
export function LangImageField({
  lang,
  title,
  value,
  onChange,
  uploadContext,
  disabled,
  error: fieldError,
  inputTestId
}: {
  lang: "ar" | "en";
  title: string;
  value: string | null;
  onChange: (value: string | null) => void;
  uploadContext: ErpUploadContext;
  disabled?: boolean;
  error?: string;
  inputTestId: string;
}) {
  const { busy, error, upload } = useImageUpload(uploadContext);

  return (
    <div className="grid content-start gap-1.5">
      <LangSlotRow
        lang={lang}
        title={title}
        src={value ? resolveMediaSrc(value) : null}
        inputTestId={inputTestId}
        canUpload={!disabled && !busy}
        busy={busy}
        onFiles={(files) => {
          void upload(files).then((url) => {
            if (url) onChange(url);
          });
        }}
        onRemove={() => onChange(null)}
        removeLabel={`إزالة ${title}`}
      />
      {error || fieldError ? <p role="alert" className="text-xs text-danger">{error || fieldError}</p> : null}
    </div>
  );
}
