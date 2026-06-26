"use client";

import { useRef, useState } from "react";
import type { ProductMedia } from "@minikoshk/shared";
import { Icon } from "@/components/ui/icons";
import { api, type ErpUploadContext } from "@/lib/api/client";

interface Props {
  value: ProductMedia[];
  onChange: (media: ProductMedia[]) => void;
  uploadContext?: ErpUploadContext;
}

export function ProductMediaUpload({ value, onChange, uploadContext }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = value.slice();
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;

    const hasExistingVideo = value.some((item) => item.type === "video");
    const incomingVideoCount = Array.from(files).filter((file) => file.type.startsWith("video/")).length;
    if ((hasExistingVideo ? 1 : 0) + incomingVideoCount > 1) {
      setError("يمكن رفع فيديو واحد فقط لكل منتج.");
      return;
    }
    if (!uploadContext) {
      setError("رفع الوسائط متاح فقط داخل مسارات التعديل المصرح بها.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => {
          const result = await api.uploadMedia(file, uploadContext);
          return {
            type: file.type.startsWith("video/") ? "video" as const : "image" as const,
            url: result.url
          };
        })
      );
      onChange([...value, ...uploaded]);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "فشل رفع الوسائط";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="muted" style={{ fontSize: 12 }}>
          أول صورة هي الأساسية في المتجر. باقي الصور والفيديوهات تظهر داخل معرض صفحة المنتج.
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => ref.current?.click()} disabled={uploading || !uploadContext}>
          <Icon.Upload size={14} /> إضافة وسائط
        </button>
      </div>

      <input
        ref={ref}
        data-testid="product-media-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
        multiple
        style={{ display: "none" }}
        onChange={(event) => { void handleFiles(event.target.files); }}
      />

      {value.length === 0 ? (
        <div className="muted" style={{ fontSize: 12 }}>ارفعي صور المنتج وفيديوه إن وجد.</div>
      ) : (
        <div className="stack">
          {value.map((item, index) => (
            <div
              key={`${item.type}-${item.url}-${index}`}
              data-testid="product-media-item"
              className="row"
              style={{ justifyContent: "space-between", gap: 12, padding: 10, border: "1px solid var(--hairline)", borderRadius: 8 }}
            >
              <div className="row" style={{ gap: 12, alignItems: "center" }}>
                {item.type === "image" ? (
                  <img src={item.url} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />
                ) : (
                  <video src={item.url} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }}>
                    <track kind="captions" />
                  </video>
                )}
                <div className="stack" style={{ gap: 4 }}>
                  <strong style={{ fontSize: 13 }}>{item.type === "image" ? "صورة" : "فيديو"}</strong>
                  {index === 0 && item.type === "image" ? (
                    <span className="muted" style={{ fontSize: 12 }}>الصورة الأساسية</span>
                  ) : null}
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button type="button" className="btn btn--ghost btn--sm" aria-label="تحريك لأعلى" onClick={() => move(index, -1)} disabled={index === 0}>
                  <span style={{ display: "inline-block", transform: "rotate(180deg)" }}>
                    <Icon.Chevron size={14} />
                  </span>
                </button>
                <button type="button" className="btn btn--ghost btn--sm" aria-label="تحريك لأسفل" onClick={() => move(index, 1)} disabled={index === value.length - 1}>
                  <Icon.Chevron size={14} />
                </button>
                <button type="button" className="btn btn--ghost btn--sm" aria-label="إزالة" onClick={() => remove(index)}>
                  <Icon.Trash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploading ? <div className="muted" style={{ fontSize: 12 }}>جارِ رفع الوسائط...</div> : null}
      {!uploadContext ? <div className="muted" style={{ fontSize: 12 }}>رفع الوسائط متاح فقط أثناء تعديل منتج موجود.</div> : null}
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  );
}
