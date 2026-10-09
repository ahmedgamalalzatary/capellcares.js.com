"use client";

import { useState } from "react";
import { ImageOff, ImagePlus } from "lucide-react";
import { ImageActions } from "@/components/forms/image-actions";
import { LangTag } from "@/components/forms/lang-tag";

function FramedImage({ src }: { src: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <div className="grid aspect-square place-items-center overflow-hidden rounded-thumb bg-surface shadow-inset">
      {failedSrc === src ? (
        <span className="grid justify-items-center gap-1.5 text-xs text-text-muted">
          <ImageOff aria-hidden className="size-5" />
          تعذر عرض الصورة
        </span>
      ) : (
        <img src={src} alt="" className="size-full object-contain" onError={() => setFailedSrc(src)} />
      )}
    </div>
  );
}

/**
 * Horizontal variant for single optional images (hover images): thumbnail beside its name and actions,
 * so a pair of them fills a wide card instead of leaving it empty.
 */
export function LangSlotRow({
  lang,
  src,
  title,
  emptyNote = "غير مضافة",
  inputTestId,
  canUpload,
  busy,
  onFiles,
  onRemove,
  removeLabel,
}: {
  lang: "ar" | "en";
  src: string | null;
  title: string;
  /** Status line when no image is set (e.g. that the other language's image is shown instead). */
  emptyNote?: string;
  inputTestId: string;
  canUpload: boolean;
  busy: boolean;
  onFiles: (files: FileList | null) => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-well bg-sunken p-3">
      <div className="size-24 shrink-0 sm:size-28">
        {src ? (
          <FramedImage src={src} />
        ) : (
          <div className="grid size-full place-items-center rounded-thumb border border-dashed border-line-strong text-text-muted">
            <ImagePlus aria-hidden className="size-5" />
          </div>
        )}
      </div>
      <div className="grid min-w-0 gap-1.5">
        <span className="flex items-center gap-1.5 text-base font-medium text-text-strong">
          <LangTag lang={lang} />
          {title}
        </span>
        <span className="text-xs text-text-muted">{src ? "مضافة" : emptyNote}</span>
        <ImageActions
          className="mt-1"
          hasImage={Boolean(src)}
          busy={busy}
          canUpload={canUpload}
          onFiles={onFiles}
          onRemove={onRemove}
          removeLabel={removeLabel}
          inputTestId={inputTestId}
        />
      </div>
    </div>
  );
}
