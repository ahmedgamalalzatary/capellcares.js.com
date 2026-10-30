"use client";

import { useRef, useState } from "react";

/** A customer can cancel an order until staff accept it. Asks once before doing it, since a cancelled order cannot come back. */
export function OrderCancel({ dict, onCancel }: { dict: any; onCancel: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState("");
  const text = dict.orders.shipping;

  async function cancel() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    try {
      await onCancel();
      setConfirming(false);
    } catch (cause) {
      setError((cause as { code?: string })?.code === "ORDER_CANCELLATION_UNAVAILABLE" ? text.cancelUnavailable : text.cancelError);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <section className="rounded-lg border border-(--hairline) bg-surface p-4 shadow-(--shadow-1) sm:p-5">
      {confirming ? (
        <div className="grid gap-3">
          <p className="m-0 text-sm text-(--ink-2)">{text.confirmMessage}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn--primary" autoFocus disabled={pending} onClick={() => void cancel()}>
              {pending ? text.cancelling : text.confirm}
            </button>
            <button type="button" className="btn btn--ghost" disabled={pending} onClick={() => { setConfirming(false); setError(""); }}>
              {text.keep}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn--ghost" onClick={() => setConfirming(true)}>{text.cancel}</button>
      )}
      {error ? <p role="alert" className="mt-3 text-sm text-(--danger)">{error}</p> : null}
    </section>
  );
}
