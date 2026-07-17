"use client";

import { useEffect, useState, type FormEvent } from "react";
import { EG_PHONE_REGEX, GOVERNORATES, GOVERNORATE_LABELS, type Order } from "@minikoshk/shared";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useResolvedCart } from "@/hooks/useResolvedCart";
import { readAuth } from "@/lib/auth";
import { clearCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { submitCheckout, toCheckoutItems } from "@/lib/checkout";

const inputClass =
  "h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-brand-dark outline-none transition focus:border-brand-dark";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-600">{label}</span>
      {children}
    </label>
  );
}

/**
 * Guest/registered checkout form posting the shared `CheckoutRequestDto` to
 * `POST /api/v1/checkout`. Client-side validation mirrors the API's zod schema
 * (Egyptian phone, governorate enum, required address fields); the API remains
 * the source of truth and its message is surfaced on rejection.
 */
export function CheckoutForm() {
  const { lang, dict } = useLocale();
  const t = dict.checkout;
  const { lines, resolved, total, loading } = useResolvedCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    governorate: "",
    cityArea: "",
    addressLine: "",
    buildingApartment: "",
    notes: ""
  });

  useEffect(() => {
    const auth = readAuth();
    if (auth) {
      setForm((current) => ({ ...current, fullName: current.fullName || auth.user.name, email: current.email || auth.user.email }));
    }
  }, []);

  // Only lines that still exist in the catalog are ordered; dead references
  // would just bounce off the API's validation with an opaque 400. The order
  // summary strikes them through so the exclusion is visible before submitting.
  const orderableLines = resolved.filter((item) => item.available).map((item) => item.line);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!EG_PHONE_REGEX.test(form.phone.trim())) {
      setError(t.invalidPhone);
      return;
    }
    setSubmitting(true);
    try {
      const created = await submitCheckout({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        governorate: form.governorate,
        cityArea: form.cityArea.trim(),
        addressLine: form.addressLine.trim(),
        buildingApartment: form.buildingApartment.trim(),
        notes: form.notes.trim() || undefined,
        paymentMethod: "cod",
        items: toCheckoutItems(orderableLines)
      });
      clearCart();
      setOrder(created);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (order) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-extrabold text-brand-dark">{t.successTitle}</h1>
        <p className="mt-4 text-gray-600">
          {t.orderCode}: <span className="font-mono text-lg font-bold text-brand-dark">{order.orderCode}</span>
        </p>
        <a
          href={`/${lang}/products`}
          className="mt-8 inline-block rounded-full bg-brand-dark px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-black"
        >
          {t.backToShop}
        </a>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-lg text-gray-500">{dict.cart.empty}</p>
        <a
          href={`/${lang}/products`}
          className="mt-6 inline-block rounded-full bg-brand-dark px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-black"
        >
          {dict.cart.continueShopping}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-5 py-10">
      <h1 className="text-2xl font-extrabold uppercase tracking-wide text-brand-dark">{t.title}</h1>

      <Field label={t.fullName}>
        <input required value={form.fullName} onChange={set("fullName")} className={inputClass} autoComplete="name" />
      </Field>
      <Field label={t.phone}>
        <input required type="tel" dir="ltr" value={form.phone} onChange={set("phone")} className={inputClass} autoComplete="tel" placeholder="01xxxxxxxxx" />
      </Field>
      <Field label={t.email}>
        <input required type="email" dir="ltr" value={form.email} onChange={set("email")} className={inputClass} autoComplete="email" />
      </Field>
      <Field label={t.governorate}>
        <select required value={form.governorate} onChange={set("governorate")} className={inputClass}>
          <option value="" disabled>{t.selectGovernorate}</option>
          {GOVERNORATES.map((governorate) => (
            <option key={governorate} value={governorate}>{GOVERNORATE_LABELS[governorate][lang]}</option>
          ))}
        </select>
      </Field>
      <Field label={t.cityArea}>
        <input required value={form.cityArea} onChange={set("cityArea")} className={inputClass} autoComplete="address-level2" />
      </Field>
      <Field label={t.addressLine}>
        <input required value={form.addressLine} onChange={set("addressLine")} className={inputClass} autoComplete="street-address" />
      </Field>
      <Field label={t.buildingApartment}>
        <input required value={form.buildingApartment} onChange={set("buildingApartment")} className={inputClass} />
      </Field>
      <Field label={t.notes}>
        <textarea value={form.notes} onChange={set("notes")} rows={3}
          className="w-full rounded-xl border border-gray-300 bg-white p-4 text-sm text-brand-dark outline-none transition focus:border-brand-dark" />
      </Field>

      <div className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-600">
        {t.paymentMethod}: {t.cod}
      </div>

      {/* Order summary: what will actually be charged, resolved against the live catalog. */}
      <section aria-label={t.orderSummary} className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-gray-500">{t.orderSummary}</h2>
        <ul className="mt-3 divide-y divide-gray-100">
          {resolved.map((item) => (
            <li key={JSON.stringify(item.line)} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className={`min-w-0 truncate font-semibold ${item.available ? "text-brand-dark" : "text-gray-400 line-through"}`}>
                {item.name} × {item.line.qty}
              </span>
              {item.available ? (
                <span className="shrink-0 font-bold text-brand-dark">
                  {formatPrice(item.unitPrice * item.line.qty, lang, dict.product.currency)}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-brand-red">{dict.cart.unavailable}</span>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
          <span className="text-sm font-bold uppercase text-gray-500">{dict.cart.total}</span>
          <span className="text-lg font-extrabold text-brand-dark">
            {loading ? "…" : formatPrice(total, lang, dict.product.currency)}
          </span>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-brand-red">{error}</p>}

      <button
        type="submit"
        disabled={submitting || loading || orderableLines.length === 0}
        className="w-full cursor-pointer rounded-full bg-brand-dark py-4 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-black disabled:opacity-50"
      >
        {submitting ? t.placing : t.placeOrder}
      </button>
    </form>
  );
}
