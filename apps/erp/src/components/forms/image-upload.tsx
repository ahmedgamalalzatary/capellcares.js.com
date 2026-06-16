"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { API_BASE, api, type ErpUploadContext } from "@/lib/api/client";

interface Props {
  value: string | null;
  onChange: (imageUrl: string | null) => void;
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

export function ImageUpload({ value, onChange, hint, uploadContext }: Props) {
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
      style={{
        border: `1.5px dashed ${dragOver ? "var(--accent)" : "var(--hairline)"}`,
        background: dragOver ? "var(--accent-soft)" : "var(--surface)",
        borderRadius: "var(--radius-lg)",
        padding: 22,
        display: "grid",
        gap: 12,
        placeItems: "center",
        textAlign: "center",
        transition: "border-color 160ms var(--ease-out-expo), background 160ms var(--ease-out-expo)"
      }}
    >
      {previewSrc ? (
        <>
          <img src={previewSrc} alt="" style={{ maxHeight: 160, borderRadius: 8 }} />
          <div className="row" style={{ gap: 8 }}>
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
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--warm-soft)", color: "var(--accent)", display: "grid", placeItems: "center" }}>
            <Icon.Upload />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>اسحبي الصورة هنا أو اضغطي للاختيار</div>
            <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>{hint ?? "PNG / JPG / WEBP — حتى 4MB"}</div>
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
        style={{ display: "none" }}
        onChange={(e) => { void handleFile(e.target.files?.[0]); }}
      />
      {!uploadContext && <div className="faint" style={{ fontSize: 12 }}>رفع الصور متاح فقط أثناء تعديل عنصر موجود.</div>}
      {uploading && <div className="faint" style={{ fontSize: 12 }}>جارِ رفع الصورة...</div>}
      {error && <div className="field-error" style={{ marginTop: 4 }}>{error}</div>}
    </div>
  );
}
