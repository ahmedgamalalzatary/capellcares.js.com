"use client";

import { useRef, useState } from "react";
import type { EntityMedia, Language } from "@capella/shared";
import { resolveLocalizedEntityMediaUrl } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { api, type ErpUploadContext } from "@/lib/api/client";

interface Props {
  value: EntityMedia[];
  onChange: (media: EntityMedia[]) => void;
  uploadContext?: ErpUploadContext;
  entityLabel?: string;
  testIdPrefix?: "product" | "offer" | "collection";
}

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
const VIDEO_ACCEPT = "video/mp4,video/webm";

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
    setUploading(true);
    setError(null);
    try {
      const [uploaded] = await upload(files);
      if (!uploaded) return;
      commit((current) => current.map((item, itemIndex) => itemIndex === index && item.type === "image"
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

  return (
    <div className="stack">
      <div className="row row--between">
        <div className="muted fs-12">
          أول صورة هي الأساسية. لكل صورة نسخة عربية وإنجليزية اختيارية، ويُستخدم المتاح منهما عند غياب الأخرى.
        </div>
        <div className="row row--gap-sm">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => addArRef.current?.click()} disabled={uploading || !uploadContext}>
            <Icon.Upload size={14} /> إضافة صور عربية
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => addEnRef.current?.click()} disabled={uploading || !uploadContext}>
            <Icon.Upload size={14} /> إضافة صور إنجليزية
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => addVideoRef.current?.click()} disabled={uploading || !uploadContext || value.some((item) => item.type === "video")}>
            <Icon.Upload size={14} /> إضافة فيديو
          </button>
        </div>
      </div>

      <input ref={addArRef} data-testid={`${testIdPrefix}-media-add-ar-input`} type="file" accept={IMAGE_ACCEPT} multiple className="file-input-hidden" onChange={(event) => { void addImages(event.target.files, "ar"); }} />
      <input ref={addEnRef} data-testid={`${testIdPrefix}-media-add-en-input`} type="file" accept={IMAGE_ACCEPT} multiple className="file-input-hidden" onChange={(event) => { void addImages(event.target.files, "en"); }} />
      <input ref={addVideoRef} data-testid={`${testIdPrefix}-media-add-video-input`} type="file" accept={VIDEO_ACCEPT} className="file-input-hidden" onChange={(event) => { void addVideo(event.target.files); }} />

      {value.length === 0 ? (
        <div className="muted fs-12">ارفعي صور {entityLabel} وفيديوه إن وجد.</div>
      ) : (
        <div className="stack">
          {value.map((item, index) => (
            <div key={item.type === "video" ? `video-${item.url}-${index}` : `image-${item.arUrl}-${item.enUrl}-${index}`} data-testid={`${testIdPrefix}-media-item`} className="media-tile stack">
              {item.type === "video" ? (
                <div className="row row--between">
                  <div className="row">
                    <video data-testid={`${testIdPrefix}-media-video-${index}`} src={item.url} className="media-tile__preview"><track kind="captions" /></video>
                    <strong className="fs-13">فيديو مشترك</strong>
                  </div>
                  <button type="button" className="btn btn--ghost btn--sm" aria-label="إزالة" onClick={() => commit((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Icon.Trash size={14} /></button>
                </div>
              ) : (
                <div className="shop-media-item__images">
                  {(["ar", "en"] as const).map((lang) => {
                    const url = lang === "ar" ? item.arUrl : item.enUrl;
                    return (
                      <div key={lang} className="stack stack--xs">
                        <strong className="fs-13">{lang === "ar" ? "الصورة العربية" : "الصورة الإنجليزية"}</strong>
                        {url ? <img src={url} alt="" className="media-tile__preview" /> : <span className="muted fs-12">غير مضافة — ستُستخدم اللغة الأخرى</span>}
                        <div className="row row--gap-sm">
                          <label className="btn btn--ghost btn--sm">
                            <Icon.Upload size={14} /> {url ? "استبدال" : "إضافة"}
                            <input
                              data-testid={`${testIdPrefix}-media-image-${lang}-input-${index}`}
                              type="file"
                              accept={IMAGE_ACCEPT}
                              className="file-input-hidden"
                              onChange={(event) => { void replaceImageLanguage(index, lang, event.target.files); }}
                            />
                          </label>
                          {url ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => removeImageLanguage(index, lang)}><Icon.Trash size={14} /> إزالة</button> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="row row--between">
                <span className="muted fs-12">{index === 0 && item.type === "image" ? "الصورة الأساسية" : resolveLocalizedEntityMediaUrl(item, "ar")}</span>
                <div className="row row--gap-sm">
                  <button type="button" className="btn btn--ghost btn--sm" aria-label="تحريك لأعلى" onClick={() => move(index, -1)} disabled={index === 0}><span className="icon-flip"><Icon.Chevron size={14} /></span></button>
                  <button type="button" className="btn btn--ghost btn--sm" aria-label="تحريك لأسفل" onClick={() => move(index, 1)} disabled={index === value.length - 1}><Icon.Chevron size={14} /></button>
                </div>
              </div>
            </div>
          ))}
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
