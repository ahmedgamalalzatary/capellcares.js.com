"use client";

import { useRef, useState } from "react";
import type { EntityMedia, Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { api, type ErpUploadContext } from "@/lib/api/client";
import "./entity-media.css";

interface Props {
  value: EntityMedia[];
  onChange: (media: EntityMedia[]) => void;
  uploadContext?: ErpUploadContext;
  entityLabel?: string;
  testIdPrefix?: "product" | "offer" | "collection";
}

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
const VIDEO_ACCEPT = "video/mp4,video/webm";

const LANG_LABEL: Record<Language, { title: string; code: string }> = {
  ar: { title: "الصورة العربية", code: "AR" },
  en: { title: "الصورة الإنجليزية", code: "EN" }
};

export function EntityMediaUpload({
  value,
  onChange,
  uploadContext,
  entityLabel = "منتج",
  testIdPrefix = "product"
}: Props) {
  const addArRef = useRef<HTMLInputElement>(null);
  const addEnRef = useRef<HTMLInputElement>(null);
  const addVideoRef = useRef<HTMLInputElement>(null);
  const latestValueRef = useRef(value);
  latestValueRef.current = value;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commit = (update: (current: EntityMedia[]) => EntityMedia[]) => {
    const next = update(latestValueRef.current);
    latestValueRef.current = next;
    onChange(next);
  };

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= latestValueRef.current.length) return;
    commit((current) => {
      const next = current.slice();
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item!);
      return next;
    });
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return [];
    if (!uploadContext) {
      setError("رفع الوسائط متاح فقط داخل مسارات التعديل المصرح بها.");
      return [];
    }
    return Promise.all(Array.from(files).map((file) => api.uploadMedia(file, uploadContext)));
  };

  const addImages = async (files: FileList | null, lang: Language) => {
    setUploading(true);
    setError(null);
    try {
      const uploaded = await upload(files);
      if (uploaded.length === 0) return;
      commit((current) => {
        const languageKey = lang === "ar" ? "arUrl" : "enUrl";
        const next = current.slice();
        let uploadedIndex = 0;

        for (let index = 0; index < next.length && uploadedIndex < uploaded.length; index += 1) {
          const item = next[index];
          if (item?.type === "image" && item[languageKey] === null) {
            next[index] = { ...item, [languageKey]: uploaded[uploadedIndex]!.url };
            uploadedIndex += 1;
          }
        }

        return [
          ...next,
          ...uploaded.slice(uploadedIndex).map(({ url }) => ({
            type: "image" as const,
            arUrl: lang === "ar" ? url : null,
            enUrl: lang === "en" ? url : null
          }))
        ];
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "فشل رفع الصور");
    } finally {
      setUploading(false);
    }
  };

  const addVideo = async (files: FileList | null) => {
    if (latestValueRef.current.some((item) => item.type === "video")) {
      setError(`يمكن رفع فيديو واحد فقط لكل ${entityLabel}.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const [uploaded] = await upload(files);
      if (uploaded) commit((current) => [...current, { type: "video", url: uploaded.url }]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "فشل رفع الفيديو");
    } finally {
      setUploading(false);
    }
  };

  const replaceImageLanguage = async (index: number, lang: Language, files: FileList | null) => {
    // Hold on to the item itself, not its position: a reorder while the upload
    // is in flight would otherwise write the new URL onto whichever image had
    // moved into this slot.
    const target = latestValueRef.current[index];
    if (!target || target.type !== "image") return;
    setUploading(true);
    setError(null);
    try {
      const [uploaded] = await upload(files);
      if (!uploaded) return;
      commit((current) => current.map((item) => item === target && item.type === "image"
        ? { ...item, [lang === "ar" ? "arUrl" : "enUrl"]: uploaded.url }
        : item));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "فشل استبدال الصورة");
    } finally {
      setUploading(false);
    }
  };

  const removeImageLanguage = (index: number, lang: Language) => {
    const item = latestValueRef.current[index];
    if (!item || item.type !== "image") return;
    const otherUrl = lang === "ar" ? item.enUrl : item.arUrl;
    if (!otherUrl) {
      commit((current) => current.filter((_, itemIndex) => itemIndex !== index));
      return;
    }
    commit((current) => current.map((entry, itemIndex) => itemIndex === index && entry.type === "image"
      ? { ...entry, [lang === "ar" ? "arUrl" : "enUrl"]: null }
      : entry));
  };

  const imageCount = value.filter((item) => item.type === "image").length;
  const hasVideo = value.some((item) => item.type === "video");
  const canUpload = Boolean(uploadContext) && !uploading;

  return (
    <div className="emedia">
      <div className="emedia__bar">
        <div className="emedia__summary">
          <span className="emedia__pill">{imageCount}</span>
          <span>{imageCount === 1 ? "صورة" : "صور"}</span>
          {hasVideo ? <span className="muted fs-12">· فيديو واحد</span> : null}
        </div>
        <div className="emedia__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => addArRef.current?.click()} disabled={!canUpload}>
            <Icon.Upload size={14} /> صور عربية
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => addEnRef.current?.click()} disabled={!canUpload}>
            <Icon.Upload size={14} /> صور إنجليزية
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => addVideoRef.current?.click()} disabled={!canUpload || hasVideo}>
            <Icon.Upload size={14} /> فيديو
          </button>
        </div>
      </div>

      <p className="emedia__hint">
        الصورة الأولى هي الأساسية في المتجر. لكل صورة نسخة عربية وإنجليزية اختيارية، ويُعرض المتاح منهما عند غياب الأخرى.
      </p>

      <input ref={addArRef} data-testid={`${testIdPrefix}-media-add-ar-input`} type="file" accept={IMAGE_ACCEPT} multiple className="file-input-hidden" onChange={(event) => { void addImages(event.target.files, "ar"); }} />
      <input ref={addEnRef} data-testid={`${testIdPrefix}-media-add-en-input`} type="file" accept={IMAGE_ACCEPT} multiple className="file-input-hidden" onChange={(event) => { void addImages(event.target.files, "en"); }} />
      <input ref={addVideoRef} data-testid={`${testIdPrefix}-media-add-video-input`} type="file" accept={VIDEO_ACCEPT} className="file-input-hidden" onChange={(event) => { void addVideo(event.target.files); }} />

      {value.length === 0 ? (
        <div className="emedia__empty-state">
          <span className="emedia__empty-icon"><Icon.Upload size={20} /></span>
          <strong className="fs-13">لا توجد وسائط بعد</strong>
          <span className="fs-12">ارفعي صور {entityLabel} وفيديوه إن وجد، باستخدام الأزرار بالأعلى.</span>
        </div>
      ) : (
        <div className="emedia__grid">
          {value.map((item, index) => {
            const key = item.type === "video"
              ? `video-${item.url}-${index}`
              : `image-${item.arUrl}-${item.enUrl}-${index}`;

            return (
              <div key={key} data-testid={`${testIdPrefix}-media-item`} className={`emedia__card${item.type === "video" ? " emedia__card--video" : ""}`}>
                <div className="emedia__head">
                  <div className="emedia__head-start">
                    <span className="emedia__index">{index + 1}</span>
                    {item.type === "video"
                      ? <span className="fs-13 fw-600">فيديو مشترك</span>
                      : index === 0 ? <span className="emedia__tag">الصورة الأساسية</span> : null}
                  </div>
                  <div className="emedia__head-end">
                    {/* Reordering or removing mid-upload would land the pending
                        file on the wrong card, so the whole panel freezes. */}
                    <button type="button" className="btn btn--ghost btn--sm" aria-label="تحريك لأعلى" onClick={() => move(index, -1)} disabled={uploading || index === 0}>
                      <span className="icon-flip"><Icon.Chevron size={14} /></span>
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" aria-label="تحريك لأسفل" onClick={() => move(index, 1)} disabled={uploading || index === value.length - 1}>
                      <Icon.Chevron size={14} />
                    </button>
                    {item.type === "video" ? (
                      <button type="button" className="btn btn--ghost btn--sm" aria-label="إزالة" disabled={uploading} onClick={() => commit((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                        <Icon.Trash size={14} />
                      </button>
                    ) : null}
                  </div>
                </div>

                {item.type === "video" ? (
                  <div className="emedia__video-row">
                    <div className="emedia__video-frame">
                      <video data-testid={`${testIdPrefix}-media-video-${index}`} src={item.url} className="emedia__video" controls>
                        <track kind="captions" />
                      </video>
                    </div>
                    <span className="muted fs-12">يُعرض هذا الفيديو للغتين معًا.</span>
                  </div>
                ) : (
                  <div className="emedia__langs">
                    {(["ar", "en"] as const).map((lang) => {
                      const url = lang === "ar" ? item.arUrl : item.enUrl;
                      const label = LANG_LABEL[lang];
                      const inputTestId = `${testIdPrefix}-media-image-${lang}-input-${index}`;

                      return (
                        <div key={lang} className="emedia__lang">
                          <span className="emedia__label">
                            <span className="emedia__label-flag">{label.code}</span>
                            {label.title}
                          </span>

                          {url ? (
                            <div className="emedia__frame">
                              <img src={url} alt="" className="emedia__img" />
                              <div className="emedia__overlay">
                                <label className="emedia__chip">
                                  <Icon.Upload size={12} /> استبدال
                                  <input
                                    data-testid={inputTestId}
                                    type="file"
                                    accept={IMAGE_ACCEPT}
                                    className="file-input-hidden"
                                    disabled={!canUpload}
                                    onChange={(event) => { void replaceImageLanguage(index, lang, event.target.files); }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  className="emedia__chip emedia__chip--danger"
                                  aria-label={`إزالة ${label.title}`}
                                  disabled={uploading}
                                  onClick={() => removeImageLanguage(index, lang)}
                                >
                                  <Icon.Trash size={12} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <label className="emedia__frame emedia__frame--empty">
                              <Icon.Upload size={16} />
                              <span>غير مضافة — ستُستخدم صورة اللغة الأخرى</span>
                              <input
                                data-testid={inputTestId}
                                type="file"
                                accept={IMAGE_ACCEPT}
                                className="file-input-hidden"
                                disabled={!canUpload}
                                onChange={(event) => { void replaceImageLanguage(index, lang, event.target.files); }}
                              />
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {uploading ? <div className="muted fs-12">جارِ رفع الوسائط...</div> : null}
      {!uploadContext ? <div className="muted fs-12">رفع الوسائط متاح فقط أثناء تعديل عنصر موجود.</div> : null}
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  );
}

export function ProductMediaUpload(props: Props) {
  return <EntityMediaUpload {...props} entityLabel="منتج" testIdPrefix="product" />;
}
