"use client";

import { useState } from "react";
import type { Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { API_BASE, api, type ErpUploadContext } from "@/lib/api/client";

interface Props {
  arValue: string;
  enValue: string;
  onChange: (lang: Language, value: string) => void;
  uploadContext?: ErpUploadContext;
}

function resolvePreviewSrc(value: string) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/uploads/")) return `${API_BASE}${value}`;
  return value;
}

export function ProductHoverImageUpload({ arValue, enValue, onChange, uploadContext }: Props) {
  const [uploading, setUploading] = useState<Language | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (lang: Language, files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!uploadContext) {
      setError("رفع صورة hover متاح فقط داخل مسارات التعديل المصرح بها.");
      return;
    }

    setUploading(lang);
    setError(null);
    try {
      const result = await api.uploadImage(file, uploadContext);
      onChange(lang, result.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "فشل رفع صورة hover");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="stack">
      <div className="muted fs-12">
        صور hover اختيارية. يستخدم المتجر صورة اللغة الأخرى تلقائيًا عند غياب النسخة المطلوبة.
      </div>
      <div className="shop-media-item__images">
        {(["ar", "en"] as const).map((lang) => {
          const value = lang === "ar" ? arValue : enValue;
          return (
            <div key={lang} className="stack stack--xs media-tile">
              <strong className="fs-13">{lang === "ar" ? "صورة hover العربية" : "صورة hover الإنجليزية"}</strong>
              {value ? <img src={resolvePreviewSrc(value)} alt="" className="media-tile__preview" /> : <span className="muted fs-12">غير مضافة</span>}
              <div className="row row--gap-sm">
                <label className="btn btn--ghost btn--sm">
                  <Icon.Upload size={14} /> {value ? "استبدال" : "إضافة"}
                  <input
                    data-testid={`product-hover-image-${lang}-input`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="file-input-hidden"
                    disabled={uploading !== null || !uploadContext}
                    onChange={(event) => { void handleFile(lang, event.target.files); }}
                  />
                </label>
                {value ? (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange(lang, "")} disabled={uploading !== null}>
                    <Icon.Trash size={14} /> إزالة
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {!uploadContext ? <div className="muted fs-12">رفع صور hover متاح فقط أثناء تعديل منتج موجود.</div> : null}
      {uploading ? <div className="muted fs-12">جارِ رفع صورة hover...</div> : null}
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  );
}
