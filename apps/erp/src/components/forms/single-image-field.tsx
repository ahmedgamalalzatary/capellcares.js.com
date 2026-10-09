"use client";

import { useState } from "react";
import { ImagePlus, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileButton } from "@/components/ui/file-button";
import { resolveMediaSrc } from "@/components/ui/thumb";
import { api, type ErpUploadContext } from "@/lib/api/client";

const ACCEPT = "image/png,image/jpeg,image/webp";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) {
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
    <div className="grid content-start gap-2.5 rounded-well bg-sunken p-3">
      <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-thumb bg-surface shadow-inset">
        {value ? (
          <img src={resolveMediaSrc(value)} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus aria-hidden className="size-6 text-text-muted" />
        )}
      </div>
      <span className="text-sm font-medium text-text-strong">{label}</span>
      <div className="flex items-center gap-1">
        <FileButton
          accept={ACCEPT}
          disabled={disabled || busy}
          onChange={(event) => { void handleFiles(event.target.files); event.target.value = ""; }}
        >
          {value ? <RefreshCw /> : <Upload />}
          {value ? "استبدال" : "رفع صورة"}
        </FileButton>
        {value ? (
          <Button variant="danger-ghost" size="icon-sm" aria-label={`إزالة ${label}`} disabled={busy} onClick={() => onChange(null)}>
            <Trash2 />
          </Button>
        ) : null}
      </div>
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
