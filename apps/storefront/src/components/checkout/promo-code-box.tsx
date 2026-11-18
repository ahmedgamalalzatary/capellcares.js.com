"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { formatPrice, type CheckoutPriceResponseDto, type Dict, type Language, type PromoAppliedDto } from "@capella/shared";
import { fillTemplate, promoRejectionMessage } from "@/lib/promo/promo-code";

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
  onSave: (code: string | null) => void;
};

/** Code box for cart and checkout (spec section 9.4): login prompt for guests, sale-replacement confirmation, a reason for every refusal. */
export function PromoCodeBox({ lang, dict, signedIn, loginHref, savedCode, promo, preview, onSave }: Props) {
  const inputId = useId();
  const titleId = useId();
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<{ code: string; promo: PromoAppliedDto } | null>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (pending) dialogRef.current?.focus();
  }, [pending]);

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
    if (!pending) return;
    onSave(pending.code);
    setPending(null);
    setText("");
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

      {pending ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
            className="grid w-full max-w-md gap-4 rounded-(--radius-lg) border border-(--hairline) bg-canvas p-6 shadow-2xl">
            <h2 id={titleId} className="m-0 text-lg font-bold text-ink">{dict.promo.confirmTitle}</h2>
            <p className="m-0 text-sm text-(--ink-2)">{dict.promo.confirmBody}</p>
            <ul className="m-0 grid list-none gap-1 p-0 text-sm text-ink">
              {pending.promo.replacedSales.map((sale) => (
                <li key={sale.index}>{fillTemplate(dict.promo.confirmLine, {
                  name: lang === "ar" ? sale.nameAr : sale.nameEn,
                  from: formatPrice(sale.previousLineTotal, lang),
                  to: formatPrice(sale.lineTotal, lang)
                })}</li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn--ghost" onClick={() => setPending(null)}>{dict.promo.confirmCancel}</button>
              <button type="button" className="btn btn--primary" onClick={confirm}>{dict.promo.confirmApply}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
