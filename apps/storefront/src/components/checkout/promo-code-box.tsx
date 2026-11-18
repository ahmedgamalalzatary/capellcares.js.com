"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { formatPrice, type CheckoutPriceResponseDto, type Dict, type Language, type PromoAppliedDto } from "@capella/shared";
import { fillTemplate, promoRejectionMessage, salesSignature } from "@/lib/promo/promo-code";

type Props = {
  lang: Language;
  dict: Dict;
  signedIn: boolean;
  loginHref: string;
  /** The code saved for this cart, as typed. */
  savedCode: string;
  /** How the server priced the saved code against the current cart. */
  promo: CheckoutPriceResponseDto["promo"];
  /** Prices the cart with a candidate code without saving it. */
  preview: (code: string) => Promise<CheckoutPriceResponseDto | null>;
  /** Saves a code, with the sale replacements the customer just accepted for it. */
  onSave: (code: string | null, acceptedSales?: string) => void;
  /** The saved code now replaces sales the customer has not accepted (after login, a cart change or a price change). */
  confirmation?: PromoAppliedDto | null;
  onConfirm?: () => void;
  onDecline?: () => void;
};

/** Code box for cart and checkout (spec section 9.4): login prompt for guests, sale-replacement confirmation, a reason for every refusal. */
export function PromoCodeBox({ lang, dict, signedIn, loginHref, savedCode, promo, preview, onSave, confirmation = null, onConfirm, onDecline }: Props) {
  const inputId = useId();
  const titleId = useId();
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<{ code: string; promo: PromoAppliedDto } | null>(null);
  const dialogRef = useRef<HTMLElement>(null);

  // A code the customer is applying now comes first; otherwise a saved code whose replacements changed asks again.
  const asking = pending ? { promo: pending.promo, again: false } : confirmation ? { promo: confirmation, again: true } : null;

  useEffect(() => {
    if (asking) dialogRef.current?.focus();
  }, [Boolean(asking)]); // eslint-disable-line react-hooks/exhaustive-deps -- focus when the dialog opens

  const apply = async () => {
    const code = text.trim();
    // One check at a time: a slower earlier answer must never overwrite a later code.
    if (!code || checking) return;
    setMessage(null);
    if (!signedIn) {
      onSave(code);
      return;
    }
    setChecking(true);
    try {
      const priced = await preview(code).catch(() => null);
      const result = priced?.promo;
      if (!result) {
        setMessage(dict.promo.checkFailed);
        return;
      }
      if (result.status === "rejected") {
        setMessage(promoRejectionMessage(result, dict, lang));
        return;
      }
      if (result.replacedSales.length > 0) {
        setPending({ code, promo: result });
        return;
      }
      onSave(code);
      setText("");
    } finally {
      setChecking(false);
    }
  };

  const confirm = () => {
    if (!pending) {
      onConfirm?.();
      return;
    }
    onSave(pending.code, salesSignature(pending.promo.replacedSales));
    setPending(null);
    setText("");
  };

  const cancel = () => {
    if (pending) setPending(null);
    else onDecline?.();
  };

  const saved = savedCode.trim();
  return (
    <div className="grid gap-2">
      {saved ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius) bg-(--warm-soft) px-3 py-2 text-sm">
          <span className="min-w-0 text-ink">
            {!signedIn ? dict.promo.loginRequired
              : promo?.status === "applied" ? fillTemplate(dict.promo.applied, { code: promo.code })
                : promo?.status === "rejected" ? fillTemplate(dict.promo.noLongerValid, { code: promo.code, reason: promoRejectionMessage(promo, dict, lang) })
                  : saved.toUpperCase()}
          </span>
          <span className="flex items-center gap-2">
            {!signedIn ? <Link href={loginHref} className="btn btn--primary btn--sm">{dict.promo.login}</Link> : null}
            <button type="button" className="text-sm text-(--ink-2) underline underline-offset-4" onClick={() => onSave(null)}>{dict.promo.remove}</button>
          </span>
        </div>
      ) : (
        <div className="grid gap-1.5">
          <label htmlFor={inputId} className="text-sm text-(--ink-2)">{dict.promo.title}</label>
          <div className="flex gap-2">
            <input id={inputId} className="input min-w-0 flex-1" dir="ltr" autoComplete="off" placeholder={dict.promo.placeholder}
              value={text} onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void apply(); } }} />
            <button type="button" className="btn btn--ghost" disabled={checking || !text.trim()} onClick={() => void apply()}>
              {checking ? dict.promo.applying : dict.promo.apply}
            </button>
          </div>
          {message ? <p role="alert" className="m-0 text-sm text-(--error)">{message}</p> : null}
        </div>
      )}

      {asking ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
            className="grid w-full max-w-md gap-4 rounded-(--radius-lg) border border-(--hairline) bg-canvas p-6 shadow-2xl">
            <h2 id={titleId} className="m-0 text-lg font-bold text-ink">{dict.promo.confirmTitle}</h2>
            <p className="m-0 text-sm text-(--ink-2)">{asking.again ? dict.promo.confirmChanged : dict.promo.confirmBody}</p>
            <ul className="m-0 grid list-none gap-1 p-0 text-sm text-ink">
              {asking.promo.replacedSales.map((sale) => (
                <li key={sale.index}>{fillTemplate(dict.promo.confirmLine, {
                  name: lang === "ar" ? sale.nameAr : sale.nameEn,
                  from: formatPrice(sale.previousLineTotal, lang),
                  to: formatPrice(sale.lineTotal, lang)
                })}</li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn--ghost" onClick={cancel}>{dict.promo.confirmCancel}</button>
              <button type="button" className="btn btn--primary" onClick={confirm}>{dict.promo.confirmApply}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
