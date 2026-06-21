"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";
import { CheckoutForm } from "./checkout-form";
import { CheckoutSummary } from "./checkout-summary";
import { useCheckout } from "../../hooks/use-checkout";
import type { CheckoutViewProps } from "../../types/checkout-view.types";

export function CheckoutView({ lang, dict }: CheckoutViewProps) {
  useCart();
  const { form, errors, placing, orderId, resolved, subtotal, setField, placeOrder } = useCheckout({ lang, dict });

  if (orderId) {
    return (
      <div className="mx-auto my-8 grid max-w-130 place-items-center gap-4 rounded-lg border border-(--hairline) bg-surface px-5 py-10 text-center shadow-(--shadow-1) sm:my-12 sm:px-8 sm:py-14">
        <div className="grid h-20 w-20 place-items-center bg-(--success) text-canvas">
          <Icon.Check size={36} />
        </div>
        <h2 className={`m-0 leading-[1.1] ${lang === "ar"
          ? "text-3xl font-bold font-(family-name:--font-ar) text-ink"
          : "text-3xl font-(--font-display) text-ink"}`}>
          {dict.common.orderPlaced}
        </h2>
        <p className="max-w-[40ch] text-sm leading-[1.7] text-(--ink-2)">{dict.common.orderPlacedDesc}</p>
        <div className="mt-2 grid gap-1">
          <span className="eyebrow text-(--ink-3)!">{dict.orders.orderCode}</span>
          <div className={`rounded-(--radius) bg-(--warm-soft) px-7 py-3 tracking-[0.08em] text-ink ${lang === "ar"
            ? "text-2xl font-bold font-(family-name:--font-ar)"
            : "text-3xl font-(--font-display)"}`}>
            {orderId}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/${lang}/orders`} className="btn btn--ghost">
            {dict.orders.viewOrders}
          </Link>
          <Link href={`/${lang}/products`} className="btn btn--primary">
            {dict.cart.keepShopping}
          </Link>
        </div>
      </div>
    );
  }

  if (resolved.length === 0) {
    return (
      <div className="mx-auto my-16 grid max-w-105 place-items-center gap-3 rounded-lg border border-(--hairline) bg-surface px-8 py-14 text-center">
        <p className="text-base text-(--ink-2)">{dict.cart.empty}</p>
        <Link href={`/${lang}/products`} className="btn btn--primary">
          {dict.cart.keepShopping}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 pb-16 sm:gap-9 sm:pb-20 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <CheckoutForm
        lang={lang}
        dict={dict}
        form={form}
        errors={errors}
        placing={placing}
        setField={setField}
        placeOrder={placeOrder}
      />
      <CheckoutSummary lang={lang} dict={dict} resolved={resolved} subtotal={subtotal} />
    </div>
  );
}
