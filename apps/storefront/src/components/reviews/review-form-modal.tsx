"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import type { ReviewCreateInput } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { submitReview } from "@/lib/api/client";
import { useModalAccessibility } from "./use-modal-accessibility";

interface Props {
  open: boolean;
  accessToken: string;
  itemName: string;
  imagePath?: string | null;
  target: Pick<ReviewCreateInput, "entityType" | "entityId">;
  dict: any;
  onClose: () => void;
  onSubmitted: () => void;
}

function format(value: string, count: number) {
  return value.replace("{count}", String(count));
}

export function ReviewFormModal({ open, accessToken, itemName, imagePath, target, dict, onClose, onSubmitted }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const commentId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const labels = dict.reviews;

  useModalAccessibility(open, overlayRef, dialogRef, onClose);

  if (!open) return null;

  const submit = async () => {
    const trimmedComment = comment.trim();
    if (rating < 1 || rating > 5 || trimmedComment.length < 3 || trimmedComment.length > 1000) {
      setError(labels.validation);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitReview(accessToken, {
        entityType: target.entityType,
        entityId: target.entityId,
        rating,
        comment: trimmedComment
      });
      onSubmitted();
    } catch {
      setError(labels.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={overlayRef} className="fixed inset-0 z-110 grid place-items-center bg-black/45 p-0 sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="flex h-full w-full flex-col bg-canvas sm:h-auto sm:max-w-lg sm:rounded-(--radius-lg) sm:border sm:border-(--hairline) sm:shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-(--hairline) p-5 sm:p-6">
          <div>
            <h2 id={titleId} className="m-0 text-2xl font-semibold text-ink">{labels.promptTitle}</h2>
            <p className="mb-0 mt-1 text-sm text-(--ink-2)">{itemName}</p>
          </div>
          <button type="button" className="btn btn--soft p-2!" aria-label={labels.close} onClick={onClose}><Icon.Close /></button>
        </header>
        <div className="grid gap-5 overflow-y-auto p-5 sm:p-6">
          {imagePath ? (
            <div className="relative h-40 overflow-hidden rounded-(--radius) bg-surface">
              <Image src={imagePath} alt={itemName} fill sizes="(max-width: 640px) 100vw, 480px" className="object-contain" />
            </div>
          ) : null}
          <fieldset className="grid gap-2 border-0 p-0">
            <legend className="text-sm font-semibold text-ink">{labels.rating}</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`border-0 bg-transparent p-1 text-3xl ${star <= rating ? "text-gold" : "text-(--hairline)"}`}
                  aria-label={format(labels.starLabel ?? "{count} stars", star)}
                  aria-pressed={rating === star}
                  onClick={() => setRating(star)}
                >★</button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-2">
            <label htmlFor={commentId} className="text-sm font-semibold text-ink">{labels.comment}</label>
            <textarea
              id={commentId}
              className="min-h-36 rounded-(--radius) border border-(--hairline) bg-surface p-3 text-ink"
              maxLength={1000}
              placeholder={labels.commentPlaceholder}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
            <span className="text-end text-xs text-(--ink-3)">{comment.length}/1000</span>
          </div>
          {error ? <p role="alert" className="m-0 text-sm text-(--error)">{error}</p> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="btn btn--primary btn--block" disabled={submitting} onClick={submit}>{submitting ? labels.submitting : labels.submit}</button>
            <button type="button" className="btn btn--ghost btn--block" disabled={submitting} onClick={onClose}>{labels.dismiss}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
