"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { api, type ErpUploadContext } from "@/lib/api/client";

interface Props {
  value: string;
  onChange: (value: string) => void;
  uploadContext?: ErpUploadContext;
}

export function ProductHoverImageUpload({ value, onChange, uploadContext }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!uploadContext) {
      setError("رفع صورة الـ hover متاح فقط داخل مسارات التعديل المصرح بها.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const result = await api.uploadImage(file, uploadContext);
      onChange(result.url);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "فشل رفع صورة الـ hover";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="muted" style={{ fontSize: 12 }}>
          هذه الصورة تظهر فقط عند تمرير بطاقة المنتج في المتجر. تركها فارغة يعني عدم وجود صورة hover.
        </div>
        <div className="row" style={{ gap: 8 }}>
          {value ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange("")} disabled={uploading}>
              <Icon.Trash size={14} /> إزالة الصورة
            </button>
          ) : null}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => ref.current?.click()} disabled={uploading || !uploadContext}>
            <Icon.Upload size={14} /> رفع صورة hover
          </button>
        </div>
      </div>

      <input
        ref={ref}
        data-testid="product-hover-image-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: "none" }}
        onChange={(event) => { void handleFiles(event.target.files); }}
      />

      {value ? (
        <div
          className="row"
          style={{ justifyContent: "space-between", gap: 12, padding: 10, border: "1px solid var(--hairline)", borderRadius: 8 }}
        >
          <div className="row" style={{ gap: 12, alignItems: "center" }}>
            <img src={value} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />
            <div className="stack" style={{ gap: 4 }}>
              <strong style={{ fontSize: 13 }}>صورة hover</strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="muted" style={{ fontSize: 12 }}>لا توجد صورة hover لهذا المنتج.</div>
      )}

      {!uploadContext ? <div className="muted" style={{ fontSize: 12 }}>رفع صورة hover متاح فقط أثناء تعديل منتج موجود.</div> : null}
      {uploading ? <div className="muted" style={{ fontSize: 12 }}>جارِ رفع صورة hover...</div> : null}
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  );
}
