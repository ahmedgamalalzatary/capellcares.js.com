"use client";

import { useState, type FormEvent } from "react";
import type { Language } from "@capella/shared";

export function ContactView({ lang, dict }: { lang: Language; dict: any }) {
  const t = dict.contact;
  const isAr = lang === "ar";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

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
    setSent(false);
  };

  if (sent) {
    return (
      <div dir={isAr ? "rtl" : "ltr"} className="py-12 text-center">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
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

      {error && <p className="field-error m-0">{error}</p>}

      <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
        {busy ? t.sending : t.submit}
      </button>
    </form>
  );
}
