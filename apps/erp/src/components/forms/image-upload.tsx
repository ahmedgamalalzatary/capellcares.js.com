"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { API_BASE, api, type ErpUploadContext } from "@/lib/api/client";

interface Props {
  value: string | null;
  onChange: (imageUrl: string | null) => void;
  label?: string;
  hint?: string;
  uploadContext?: ErpUploadContext;
}

function resolvePreviewSrc(value: string | null) {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return `${API_BASE}${value}`;
  }

  return value;
}

export function ImageUpload({ value, onChange, label, hint, uploadContext }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewSrc = resolvePreviewSrc(value);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("نوع الصورة غير مدعوم. استخدمي PNG/JPG/WEBP.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("حجم الصورة أكبر من 4MB.");
      return;
    }
    if (!uploadContext) {
      setError("رفع الصور متاح فقط داخل مسارات التعديل المصرح بها.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const result = await api.uploadImage(file, uploadContext);
      onChange(result.url);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "فشل رفع الصورة";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleFile(e.dataTransfer.files?.[0]);
      }}
      className="dropzone"
      data-drag-over={dragOver}
    >
      {label ? <div className="dropzone__label">{label}</div> : null}
      {previewSrc ? (
        <>
          <img src={previewSrc} alt="" className="dropzone__preview" />
          <div className="row row--gap-md">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => ref.current?.click()} disabled={uploading || !uploadContext}>
              <Icon.Upload size={14} /> استبدال الصورة
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange(null)} disabled={uploading}>
              <Icon.Trash size={14} /> إزالة
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="dropzone__icon">
            <Icon.Upload />
          </div>
          <div>
            <div className="dropzone__title">اسحبي الصورة هنا أو اضغطي للاختيار</div>
            <div className="faint dropzone__hint">{hint ?? "PNG / JPG / WEBP — حتى 4MB"}</div>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => ref.current?.click()} disabled={uploading || !uploadContext}>
            <Icon.Upload size={14} /> اختيار صورة
          </button>
        </>
      )}
      <input
        type="file"
        accept="image/*"
        ref={ref}
        className="file-input-hidden"
        onChange={(e) => { void handleFile(e.target.files?.[0]); }}
      />
      {!uploadContext && <div className="faint fs-12">رفع الصور متاح فقط أثناء تعديل عنصر موجود.</div>}
      {uploading && <div className="faint fs-12">جارِ رفع الصورة...</div>}
      {error && <div className="field-error field-error--offset-sm">{error}</div>}
    </div>
  );
}
