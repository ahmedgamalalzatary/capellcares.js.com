"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/providers/cart-provider";
import { fetchCheckoutStatus, retryPaymobCheckout, type CheckoutStatus } from "@/lib/api/client";
import { clearPendingCheckout, getPendingCheckoutId, getPendingCheckoutLang, redirectToPaymob, rememberPendingCheckout } from "@/lib/paymob-browser-session";
import type { CheckoutViewProps } from "@/types/checkout-view.types";

export function PaymobResult({ lang, dict }: CheckoutViewProps) {
  const { clear } = useCart();
  const router = useRouter();
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [status, setStatus] = useState<CheckoutStatus | null>(null);
  const [error, setError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const savedLang = getPendingCheckoutLang();
    if (savedLang && savedLang !== lang) {
      router.replace(`/${savedLang}/checkout/payment-result`);
      return;
    }
    setCheckoutId(getPendingCheckoutId());
    setSessionLoaded(true);
  }, [lang, router]);

  useEffect(() => {
    if (!checkoutId || status?.status === "completed" || status?.status === "expired") return;
    let cancelled = false;
    const refresh = () => {
      void fetchCheckoutStatus(checkoutId)
        .then((result) => {
          if (!cancelled) { setStatus(result); setError(false); }
        })
        .catch(() => { if (!cancelled) setError(true); });
    };
    refresh();
    const interval = window.setInterval(refresh, 4000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [checkoutId, status?.status]);

  useEffect(() => {
    if (status?.status === "completed" && status.order) {
      clear();
      clearPendingCheckout();
    } else if (status?.status === "expired" && status.latestAttemptStatus !== "reconciliation_required") {
      clearPendingCheckout();
    }
  }, [clear, status]);

  const retry = async () => {
    if (!checkoutId || !status?.canRetry || retrying) return;
    setRetrying(true);
    setError(false);
    try {
      const result = await retryPaymobCheckout(checkoutId);
      if (!result) throw new Error("Retry failed");
      rememberPendingCheckout(result.checkoutId, lang);
      redirectToPaymob(result.checkoutUrl);
    } catch {
      setError(true);
      setRetrying(false);
    }
  };

  const completed = status?.status === "completed" && status.order;
  const expired = status?.status === "expired";
  const needsReview = status?.latestAttemptStatus === "reconciliation_required";
  const failed = status?.latestAttemptStatus === "failed" && !completed && !expired;
  const noCheckout = sessionLoaded && !checkoutId;
  return (
    <section className="mx-auto my-8 grid max-w-130 gap-5 rounded-lg border border-(--hairline) bg-surface p-6 shadow-(--shadow-1) sm:my-12 sm:p-10">
      <h1 className={`m-0 text-3xl text-ink ${lang === "ar" ? "font-bold font-(family-name:--font-ar)" : "font-(--font-display)"}`}>
        {noCheckout ? dict.checkout.noPaymentToCheck : completed ? dict.checkout.paymentConfirmed : needsReview ? dict.checkout.paymentNeedsReview : expired ? dict.checkout.paymentExpired :
          failed ? dict.checkout.paymentFailed : dict.checkout.paymentConfirming}
      </h1>
      <p className="m-0 text-sm leading-7 text-(--ink-2)">
        {noCheckout ? dict.checkout.noPaymentToCheckDesc : completed ? dict.checkout.paymentConfirmedDesc : needsReview ? dict.checkout.paymentNeedsReviewDesc : expired ? dict.checkout.paymentExpiredDesc :
          failed ? dict.checkout.paymentFailedDesc : dict.checkout.paymentConfirmingDesc}
      </p>
      {completed && <div className="rounded-(--radius) bg-(--warm-soft) px-6 py-3 text-xl text-ink">
        {status.order!.orderCode}
      </div>}
      {error && <p role="alert" className="m-0 text-sm text-(--danger)">{dict.checkout.paymentStatusUnavailable}</p>}
      {needsReview && <p className="m-0 break-all text-sm text-(--ink-2)">{dict.checkout.checkoutReference}: {checkoutId}</p>}
      {status?.canRetry && <button type="button" className="btn btn--primary" disabled={retrying}
        onClick={() => { void retry(); }}>{retrying ? dict.common.loading : dict.checkout.retryPayment}</button>}
      <div className="flex flex-wrap gap-3">
        {completed && <Link href={`/${lang}/orders`} className="btn btn--ghost">{dict.orders.viewOrders}</Link>}
        {needsReview && <a href="https://wa.me/201034668590" className="btn btn--primary">{dict.checkout.contactSupport}</a>}
        {((expired && !needsReview) || !checkoutId) && <Link href={`/${lang}/checkout`} className="btn btn--primary">
          {dict.checkout.returnToCheckout}</Link>}
      </div>
    </section>
  );
}
