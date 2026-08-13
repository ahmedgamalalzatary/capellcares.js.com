"use client";

import { useState } from "react";
import type { Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { API_BASE, api, type ErpUploadContext } from "@/lib/api/client";
import "./entity-media.css";

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
    <div className="emedia">
      <p className="emedia__hint">
        صور hover اختيارية. يستخدم المتجر صورة اللغة الأخرى تلقائيًا عند غياب النسخة المطلوبة.
      </p>
      {/* Same card/frame vocabulary as the main media panel, so both blocks in
          the editor read as one system. */}
      <div className="emedia__card">
        <div className="emedia__langs">
          {(["ar", "en"] as const).map((lang) => {
            const value = lang === "ar" ? arValue : enValue;
            const inputTestId = `product-hover-image-${lang}-input`;
            const input = (
              <input
                data-testid={inputTestId}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="file-input-hidden"
                disabled={uploading !== null || !uploadContext}
                onChange={(event) => { void handleFile(lang, event.target.files); }}
              />
            );

            return (
              <div key={lang} className="emedia__lang">
                <span className="emedia__label">
                  <span className="emedia__label-flag">{lang === "ar" ? "AR" : "EN"}</span>
                  {lang === "ar" ? "صورة hover العربية" : "صورة hover الإنجليزية"}
                </span>

                {value ? (
                  <div className="emedia__frame">
                    <img src={resolvePreviewSrc(value)} alt="" className="emedia__img" />
                    <div className="emedia__overlay">
                      <label className="emedia__chip">
                        <Icon.Upload size={12} /> استبدال
                        {input}
                      </label>
                      <button
                        type="button"
                        className="emedia__chip emedia__chip--danger"
                        aria-label={`إزالة صورة hover ${lang === "ar" ? "العربية" : "الإنجليزية"}`}
                        onClick={() => onChange(lang, "")}
                        disabled={uploading !== null}
                      >
                        <Icon.Trash size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="emedia__frame emedia__frame--empty">
                    <Icon.Upload size={16} />
                    <span>غير مضافة</span>
                    {input}
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {!uploadContext ? <div className="muted fs-12">رفع صور hover متاح فقط أثناء تعديل منتج موجود.</div> : null}
      {uploading ? <div className="muted fs-12">جارِ رفع صورة hover...</div> : null}
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  );
}
