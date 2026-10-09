"use client";

import { useRef, useState } from "react";
import type { EntityMedia, Language } from "@capella/shared";
import { ArrowDown, ArrowUp, Film, ImagePlus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api, type ErpUploadContext } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { IMAGE_ACCEPT, LangSlotRow } from "./media-frame";

interface Props {
  value: EntityMedia[];
  onChange: (media: EntityMedia[]) => void;
  uploadContext?: ErpUploadContext;
  entityLabel?: string;
  testIdPrefix?: "product" | "offer" | "collection";
}

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
    // Hold on to the item itself, not its position: a reorder while the upload is in flight would otherwise write the new URL onto whichever image had moved into this slot.
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
    <div className="@container grid gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="flex-1 text-sm text-text-2">
          <span className="num font-medium text-text-strong">{formatNumber(imageCount)}</span> {imageCount === 1 ? "صورة" : "صور"}
          {hasVideo ? " · فيديو واحد" : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => addArRef.current?.click()} disabled={!canUpload}>
            <ImagePlus /> صور عربية
          </Button>
          <Button size="sm" onClick={() => addEnRef.current?.click()} disabled={!canUpload}>
            <ImagePlus /> صور إنجليزية
          </Button>
          <Button size="sm" onClick={() => addVideoRef.current?.click()} disabled={!canUpload || hasVideo}>
            <Film /> فيديو
          </Button>
        </div>
      </div>

      <input ref={addArRef} data-testid={`${testIdPrefix}-media-add-ar-input`} type="file" accept={IMAGE_ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => { void addImages(event.target.files, "ar"); }} />
      <input ref={addEnRef} data-testid={`${testIdPrefix}-media-add-en-input`} type="file" accept={IMAGE_ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => { void addImages(event.target.files, "en"); }} />
      <input ref={addVideoRef} data-testid={`${testIdPrefix}-media-add-video-input`} type="file" accept={VIDEO_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => { void addVideo(event.target.files); }} />

      {value.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-well border border-dashed border-line-strong bg-sunken px-6 py-10 text-center">
          <ImagePlus aria-hidden className="size-6 text-text-muted" />
          <p className="text-base font-medium text-text-strong">لا توجد وسائط بعد</p>
          <p className="max-w-sm text-sm text-text-muted">ارفعي صور ال{entityLabel} وفيديو إن وجد من الأزرار بالأعلى. الصورة الأولى هي الأساسية في المتجر.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-text-muted">
            الصورة الأولى هي الأساسية في المتجر. لكل صورة نسخة عربية وإنجليزية، ويُعرض المتاح منهما عند غياب الأخرى.
          </p>
          <ol className="grid gap-3">
            {value.map((item, index) => {
              const key = item.type === "video"
                ? `video-${item.url}-${index}`
                : `image-${item.arUrl}-${item.enUrl}-${index}`;
              const primary = index === 0 && item.type === "image";

              return (
                <li
                  key={key}
                  data-testid={`${testIdPrefix}-media-item`}
                  className="grid items-center gap-3 border-b border-line pb-3 last:border-0 last:pb-0 @2xl:grid-cols-[3.25rem_minmax(0,1fr)_minmax(0,1fr)]"
                >
                  {/* Order: number (nude when it is the store's main image) + move controls.
                      Reordering or removing mid-upload would land the pending file on the wrong row, so the panel freezes. */}
                  <div className="flex items-center gap-1 @2xl:flex-col">
                    <span
                      className={cn(
                        "num grid size-7 place-items-center rounded-full text-sm font-medium",
                        primary ? "bg-nude-soft text-nude-strong" : "bg-sunken text-text-2",
                      )}
                    >
                      {index + 1}
                    </span>
                    {primary ? <span className="text-xs font-medium text-nude-strong">الأساسية</span> : null}
                    <span className="ms-auto flex items-center @2xl:ms-0 @2xl:flex-col">
                      <Button variant="ghost" size="icon-sm" aria-label="تحريك لأعلى" onClick={() => move(index, -1)} disabled={uploading || index === 0}>
                        <ArrowUp />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="تحريك لأسفل" onClick={() => move(index, 1)} disabled={uploading || index === value.length - 1}>
                        <ArrowDown />
                      </Button>
                    </span>
                  </div>

                  {item.type === "video" ? (
                    <div className="flex min-w-0 items-center gap-4 rounded-well bg-sunken p-3 @2xl:col-span-2">
                      <div className="w-40 shrink-0 overflow-hidden rounded-thumb bg-sand-950 sm:w-52">
                        <video data-testid={`${testIdPrefix}-media-video-${index}`} src={item.url} className="aspect-video w-full" controls>
                          <track kind="captions" />
                        </video>
                      </div>
                      <div className="grid min-w-0 gap-1.5">
                        <span className="text-base font-medium text-text-strong">فيديو</span>
                        <span className="text-xs text-text-muted">يُعرض للغتين معًا.</span>
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          className="mt-1 justify-self-start"
                          disabled={uploading}
                          onClick={() => commit((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        >
                          <Trash2 /> إزالة الفيديو
                        </Button>
                      </div>
                    </div>
                  ) : (
                    (["ar", "en"] as const).map((lang) => (
                      <LangSlotRow
                        key={lang}
                        lang={lang}
                        title={lang === "ar" ? "الصورة العربية" : "الصورة الإنجليزية"}
                        emptyNote="غير مضافة — تُعرض صورة اللغة الأخرى"
                        src={lang === "ar" ? item.arUrl : item.enUrl}
                        inputTestId={`${testIdPrefix}-media-image-${lang}-input-${index}`}
                        canUpload={canUpload}
                        busy={uploading}
                        onFiles={(files) => { void replaceImageLanguage(index, lang, files); }}
                        onRemove={() => removeImageLanguage(index, lang)}
                        removeLabel={`إزالة الصورة ${lang === "ar" ? "العربية" : "الإنجليزية"}`}
                      />
                    ))
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}

      {uploading ? <p role="status" className="text-sm text-text-muted">جارٍ رفع الوسائط…</p> : null}
      {!uploadContext ? <p className="text-sm text-text-muted">رفع الوسائط متاح فقط أثناء تعديل عنصر موجود.</p> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

export function ProductMediaUpload(props: Props) {
  return <EntityMediaUpload {...props} entityLabel="منتج" testIdPrefix="product" />;
}
