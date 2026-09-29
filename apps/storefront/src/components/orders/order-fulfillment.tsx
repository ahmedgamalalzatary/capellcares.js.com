"use client";

import { useRef, useState } from "react";
import type { CustomerOrderFulfillment } from "@capella/shared";

export function OrderFulfillment({ fulfillment, dict, compact = false, onCancel, onRefresh }: {
  fulfillment: CustomerOrderFulfillment; dict: any; compact?: boolean;
  onCancel?: () => Promise<void>; onRefresh?: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<"cancel" | "refresh" | null>(null);
  const pendingRef = useRef(false);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");
  const text = dict.orders.shipping;
  const steps = ["placed", "preparing", "shipped", "delivered"] as const;
  const current = steps.indexOf(fulfillment.stage);
  const message = fulfillment.status === "active" ? null : fulfillment.issue === "address" ? text.address
    : fulfillment.issue === "lost" ? text.lost : fulfillment.issue === "damaged" ? text.damaged : text[fulfillment.status];

  async function run(action: "cancel" | "refresh") {
    if (pendingRef.current) return;
    pendingRef.current = true; setPending(action); setError("");
    try {
      await (action === "cancel" ? onCancel?.() : onRefresh?.());
      setConfirming(false);
    } catch (error) {
      setError(action === "refresh" ? text.refreshError : (error as { code?: string })?.code === "ORDER_CANCELLATION_UNAVAILABLE" ? text.cancelUnavailable : text.cancelError);
    } finally { pendingRef.current = false; setPending(null); }
  }

  if (compact) return <div className="border-t border-(--hairline) px-4 py-3 text-sm sm:px-5">
    <span className="font-medium text-ink">{text[fulfillment.stage]}</span>
    {message && <p className="mt-1 text-(--ink-2)">{message}</p>}
    {fulfillment.refundStatus && <p className="mt-1 text-(--ink-2)">{fulfillment.refundStatus === "pending" ? text.refundPending : text[fulfillment.refundStatus]}</p>}
  </div>;

  return <section aria-label={text.title} className="rounded-lg border border-(--hairline) bg-surface p-4 shadow-(--shadow-1) sm:p-5">
    <h2 className="m-0 text-sm font-semibold text-ink">{text.title}</h2>
    <ol className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-4 sm:gap-2">
      {steps.map((step, index) => <li key={step} aria-current={index === current ? "step" : undefined}
        className={`flex items-center gap-2 text-sm ${index <= current ? "font-medium text-ink" : "text-(--ink-3)"}`}>
        <span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${index <= current ? "bg-(--accent-soft) text-accent" : "bg-(--warm-soft)"}`}>{index + 1}</span>
        <span>{text[step]}</span>
      </li>)}
    </ol>
    <div aria-live="polite" className="mt-3 grid gap-2 text-sm text-(--ink-2)">
      {message && <p>{message}</p>}
      {fulfillment.relatedShipments.map((shipment, index) => <p key={index}>{text[shipment.kind]}: {text.carrier[shipment.status]}</p>)}
      {fulfillment.refundStatus && <p>{fulfillment.refundStatus === "pending" ? text.refundPending : text[fulfillment.refundStatus]}</p>}
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      {onRefresh && <button type="button" className="btn btn--ghost" disabled={pending !== null} onClick={() => void run("refresh")}>{pending === "refresh" ? text.refreshing : text.refresh}</button>}
      {fulfillment.canCancel && onCancel && !confirming && <button ref={cancelButton} type="button" className="btn btn--ghost" disabled={pending !== null} onClick={() => { setConfirming(true); setError(""); }}>{text.cancel}</button>}
    </div>
    {confirming && fulfillment.canCancel && <div className="mt-3 rounded-md border border-(--hairline) bg-(--warm-soft) p-3">
      <p className="text-sm text-(--ink-2)">{text.confirmMessage}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn--primary" autoFocus disabled={pending !== null} onClick={() => void run("cancel")}>{pending === "cancel" ? text.cancelling : text.confirm}</button>
        <button type="button" className="btn btn--ghost" disabled={pending !== null} onClick={() => { setConfirming(false); setError(""); requestAnimationFrame(() => cancelButton.current?.focus()); }}>{text.keep}</button>
      </div>
    </div>}
    {error && <p role="alert" className="mt-3 text-sm text-(--error)">{error}</p>}
  </section>;
}
