"use client";

import type { ReactNode } from "react";
import { GOVERNORATES } from "@capella/shared";
import type { CheckoutFormProps } from "../../types/checkout-view.types";

export function CheckoutForm({
  dict,
  form,
  errors,
  placing,
  setField,
  placeOrder
}: CheckoutFormProps) {
  return (
    <form
      className="grid gap-7"
      onSubmit={(event) => {
        event.preventDefault();
        void placeOrder();
      }}
      noValidate
    >
      <Section title={dict.checkout.contact}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={dict.checkout.fullName} error={errors.fullName}>
            <input className="input" value={form.fullName} onChange={(event) => setField("fullName", event.target.value)} />
          </Field>
          <Field label={dict.checkout.email} error={errors.email}>
            <input className="input" type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} />
          </Field>
          <Field label={dict.checkout.phone} error={errors.phone}>
            <input className="input" inputMode="tel" placeholder="01XXXXXXXXX" value={form.phone} onChange={(event) => setField("phone", event.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title={dict.checkout.shipping}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={dict.checkout.governorate} error={errors.governorate}>
            <select className="select" value={form.governorate} onChange={(event) => setField("governorate", event.target.value)}>
              <option value="">—</option>
              {GOVERNORATES.map((governorate) => (
                <option key={governorate} value={governorate}>
                  {governorate}
                </option>
              ))}
            </select>
          </Field>
          <Field label={dict.checkout.city} error={errors.city}>
            <input className="input" value={form.cityArea} onChange={(event) => setField("cityArea", event.target.value)} />
          </Field>
          <Field label={dict.checkout.addressLine} error={errors.addressLine} fullWidth>
            <input className="input" value={form.addressLine} onChange={(event) => setField("addressLine", event.target.value)} />
          </Field>
          <Field label={dict.checkout.building} error={errors.building}>
            <input className="input" value={form.buildingApartment} onChange={(event) => setField("buildingApartment", event.target.value)} />
          </Field>
          <Field label={dict.checkout.notes} fullWidth>
            <textarea className="textarea" value={form.notes} onChange={(event) => setField("notes", event.target.value)} rows={3} />
          </Field>
        </div>
      </Section>

      <Section title={dict.checkout.payment}>
        <div className="grid gap-2.5">
          <label
            className="grid cursor-pointer grid-cols-[20px_1fr] items-center gap-3.5 rounded-[12px] border border-(--hairline) bg-surface px-4 py-3.5"
            data-active={form.paymentMethod === "cod"}
          >
            <input type="radio" name="pay" value="cod" aria-label={dict.checkout.cod} checked={form.paymentMethod === "cod"} onChange={() => setField("paymentMethod", "cod")} />
            <div>
              <div className="font-semibold">{dict.checkout.cod}</div>
              <div className="text-sm text-(--ink-2)">{dict.checkout.codDesc}</div>
            </div>
          </label>
        </div>
      </Section>

      {errors.submit && <span className="text-sm text-(--danger)">{errors.submit}</span>}

      <button type="submit" className="btn btn--primary btn--block h-[52px]" disabled={placing}>
        {placing ? dict.common.loading : dict.checkout.placeOrder}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-lg border border-(--hairline) bg-surface p-5 shadow-(--shadow-1) sm:gap-5 sm:p-7">
      <h2 className="m-0 text-lg font-medium tracking-[-0.005em] text-ink sm:text-xl">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  fullWidth,
  children
}: {
  label: string;
  error?: string;
  fullWidth?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={fullWidth ? "grid gap-1.5 md:col-span-2" : "grid gap-1.5"}>
      <label className="grid gap-1.5 text-sm font-medium text-(--ink-2)">
        {label}
        {children}
      </label>
      {error && <span className="text-xs text-(--danger)">{error}</span>}
    </div>
  );
}
