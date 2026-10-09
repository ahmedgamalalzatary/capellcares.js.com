"use client";

import { ImagePlus } from "lucide-react";
import { ImageActions } from "@/components/forms/image-actions";
import { useImageUpload } from "@/hooks/use-image-upload";
import { resolveMediaSrc } from "@/lib/media";
import type { ErpUploadContext } from "@/lib/api/client";

/** One optional image: a framed preview with a label and upload/replace/remove controls. */
export function SingleImageField({
  label,
  value,
  onChange,
  uploadContext,
  disabled
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  uploadContext: ErpUploadContext;
  disabled?: boolean;
}) {
  const { busy, error, upload } = useImageUpload(uploadContext);

  const handleFiles = async (files: FileList | null) => {
    const url = await upload(files);
    if (url) onChange(url);
  };

  return (
    <div className="grid content-start gap-2.5 rounded-well bg-sunken p-3">
      <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-thumb bg-surface shadow-inset">
        {value ? (
          <img src={resolveMediaSrc(value)} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus aria-hidden className="size-6 text-text-muted" />
        )}
      </div>
      <span className="text-sm font-medium text-text-strong">{label}</span>
      <ImageActions
        hasImage={Boolean(value)}
        busy={busy}
        canUpload={!disabled && !busy}
        disabled={disabled}
        onFiles={(files) => { void handleFiles(files); }}
        onRemove={() => onChange(null)}
        removeLabel={`إزالة ${label}`}
      />
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
