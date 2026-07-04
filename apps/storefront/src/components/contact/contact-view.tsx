"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent
} from "react";
import type { Language } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { CONTACT_MAX_FILES, CONTACT_MAX_TOTAL_MB } from "@/constants/ui";

type Attachment = { file: File; url: string };

export function ContactView({ lang, dict }: { lang: Language; dict: any }) {
  const t = dict.contact;
  const isAr = lang === "ar";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep a live ref so the unmount cleanup revokes whatever previews remain
  // without re-running (and prematurely revoking) on every add/remove.
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.url));
    };
  }, []);

  const fill = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));

  const addFiles = (incoming: File[]) => {
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      if (incoming.length > 0) setError(t.attachmentsWrongType);
      return;
    }
    setError(null);

    setAttachments((prev) => {
      if (prev.length + images.length > CONTACT_MAX_FILES) {
        setError(fill(t.attachmentsTooMany, { max: CONTACT_MAX_FILES }));
        return prev;
      }
      const total = [...prev, ...images.map((file) => ({ file }))].reduce(
        (sum, a) => sum + a.file.size,
        0
      );
      if (total > CONTACT_MAX_TOTAL_MB * 1024 * 1024) {
        setError(fill(t.attachmentsTooLarge, { size: CONTACT_MAX_TOTAL_MB }));
        return prev;
      }
      return [...prev, ...images.map((file) => ({ file, url: URL.createObjectURL(file) }))];
    });
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    // Allow re-selecting the same file after a removal.
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(e.clipboardData.files ?? []);
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const removeAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
    URL.revokeObjectURL(url);
  };

  const reasonKeys = [
    "orderStatus",
    "modifyOrder",
    "returns",
    "missing",
    "damaged",
    "product",
    "shipping",
    "productQuestion",
    "partnership",
    "wholesale",
    "other"
  ] as const;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !reason || !subject.trim() || !message.trim()) {
      setError(t.required);
      return;
    }

    setBusy(true);
    // No contact API yet — simulate a submission and surface the success state.
    await new Promise((resolve) => setTimeout(resolve, 700));
    setBusy(false);
    setSent(true);
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setReason("");
    setOrderNumber("");
    setSubject("");
    setMessage("");
    attachments.forEach((a) => URL.revokeObjectURL(a.url));
    setAttachments([]);
    setSent(false);
  };

  if (sent) {
    return (
      <div dir={isAr ? "rtl" : "ltr"} className="py-12 text-center">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon.Check size={28} />
        </span>
        <h2 className="m-0 text-2xl text-ink font-(family-name:--font-display)">{t.successTitle}</h2>
        <p className="mt-3 text-sm leading-[1.7] text-(--ink-2)">{t.successBody}</p>
        <button type="button" onClick={resetForm} className="btn btn--outline-accent mt-7">
          {t.sendAnother}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-5" dir={isAr ? "rtl" : "ltr"} noValidate>
      <p className="m-0 text-sm text-(--ink-2)">{t.requiredHint}</p>

      <div className="field--float" data-filled={name.trim() !== ""}>
        <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <label htmlFor="c-name">{t.name} <span className="text-(--error)">*</span></label>
      </div>

      <div className="field--float" data-filled={email.trim() !== ""}>
        <input id="c-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <label htmlFor="c-email">{t.email} <span className="text-(--error)">*</span></label>
      </div>

      <div className="field--float" data-filled={reason !== ""}>
        <select id="c-reason" className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="" disabled hidden></option>
          {reasonKeys.map((key) => (
            <option key={key} value={key}>{t.reasons[key]}</option>
          ))}
        </select>
        <label htmlFor="c-reason">{t.reason} <span className="text-(--error)">*</span></label>
      </div>

      <div className="field--float" data-filled={orderNumber.trim() !== ""}>
        <input id="c-order" className="input" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
        <label htmlFor="c-order">
          {t.orderNumber} <span className="font-normal text-(--ink-3)">({t.orderNumberOptional})</span>
        </label>
      </div>

      <div className="field--float" data-filled={subject.trim() !== ""}>
        <input id="c-subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <label htmlFor="c-subject">{t.subject} <span className="text-(--error)">*</span></label>
      </div>

      <div className="field--float" data-filled={message.trim() !== ""}>
        <textarea id="c-message" className="textarea" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
        <label htmlFor="c-message">{t.message} <span className="text-(--error)">*</span></label>
      </div>

      <div className="grid gap-3">
        <p className="m-0 text-sm text-(--ink-2)">
          {fill(t.attachmentsHint, { max: CONTACT_MAX_FILES, size: CONTACT_MAX_TOTAL_MB })}
        </p>

        {attachments.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
            {attachments.map((a) => (
              <li key={a.url} className="relative">
                <img
                  src={a.url}
                  alt={a.file.name}
                  className="h-20 w-20 rounded-(--radius) border border-(--hairline) object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(a.url)}
                  aria-label={`${t.attachmentsRemove} ${a.file.name}`}
                  className="absolute inset-e-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white shadow"
                >
                  <Icon.Close size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onPaste={onPaste}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          data-drag={dragOver}
          className="input flex cursor-pointer items-center justify-between gap-4 text-(--ink-3) data-[drag=true]:border-accent data-[drag=true]:bg-(--surface-2)"
        >
          <span className="flex items-center gap-2.5">
            <Icon.Image size={20} className="shrink-0" />
            {t.attachmentsDropzone}
          </span>
          <span className="flex items-center gap-2 text-ink">
            <Icon.Upload size={20} className="shrink-0" />
            {t.attachmentsUpload}
          </span>
        </div>

        <input
          ref={fileInputRef}
          id="c-attachments"
          type="file"
          accept="image/*"
          multiple
          onChange={onInputChange}
          className="sr-only"
        />
      </div>

      {error && <p className="field-error m-0">{error}</p>}

      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
        {busy ? t.sending : t.submit}
      </button>
    </form>
  );
}
