"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPrice, type Language, type OrderSummary } from "@capella/shared";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchCustomerOrders } from "@/lib/api/client";
import { Icon } from "@/components/ui/icons";
import { authHref } from "@/lib/auth-redirect";
import {
  formatOrderDate,
  itemsCountLabel,
  OrderItemMedia,
  paymentStatusChip,
  paymentStatusLabel,
  useCatalog
} from "./order-presentation";

/** Thumbnails shown on a card before collapsing the rest into a "+N" chip. */
const MAX_THUMBS = 4;

export function OrdersView({ lang, dict }: { lang: Language; dict: any }) {
  const { user, accessToken, logout } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const catalog = useCatalog();

  useEffect(() => {
    if (user && !accessToken) {
      setOrders([]);
      setLoadError(false);
      setLoading(true);
      return;
    }

    if (!accessToken) {
      setOrders([]);
      setLoadError(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setOrders([]);
    setAuthRequired(false);
    setLoadError(false);
    setLoading(true);
    fetchCustomerOrders(accessToken)
      .then((items) => {
        if (cancelled) return;
        setOrders(items);
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof Error && error.message.includes("API 401")) {
          setAuthRequired(true);
          void logout().catch(() => {});
        } else {
          setLoadError(true);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, accessToken, logout]);

  const isAr = lang === "ar";

  if (!user || authRequired) {
    return (
      <div className="mx-auto my-10 grid max-w-120 place-items-center gap-4 rounded-lg border border-(--hairline) bg-surface px-6 py-12 text-center sm:my-16 sm:px-8 sm:py-14">
        <div className="grid h-19 w-19 place-items-center bg-(--accent-soft) text-accent">
          <Icon.User size={32} />
        </div>
        <h2 className={`m-0 leading-[1.1] ${isAr
          ? "text-2xl font-bold font-(family-name:--font-ar) text-ink"
          : "text-3xl font-(--font-display) text-ink"}`}>
          {dict.orders.loginRequired}
        </h2>
        <p className="max-w-[44ch] text-sm leading-[1.7] text-(--ink-2)">{dict.orders.loginRequiredDesc}</p>
        <Link href={authHref("login", lang, `/${lang}/orders`)} className="btn btn--primary btn--lg mt-1">
          {dict.wishlist.goLogin}
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mb-16 grid gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-lg border border-(--hairline) bg-(--warm-soft)"
          />
        ))}
      </div>
    );
  }

  if (loadError) {
    return <p role="alert" className="py-12 text-center text-sm text-(--error)">{dict.orders.loadError}</p>;
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto my-10 grid max-w-120 place-items-center gap-4 rounded-lg border border-(--hairline) bg-surface px-6 py-12 text-center sm:my-16 sm:px-8 sm:py-14">
        <div className="grid h-19 w-19 place-items-center bg-(--warm-soft) text-ink">
          <Icon.Cart size={32} />
        </div>
        <h2 className={`m-0 leading-[1.1] ${isAr
          ? "text-2xl font-bold font-(family-name:--font-ar) text-ink"
          : "text-3xl font-(--font-display) text-ink"}`}>
          {dict.orders.empty}
        </h2>
        <p className="text-sm text-(--ink-2)">{dict.orders.startShopping}</p>
        <Link href={`/${lang}/products`} className="btn btn--primary mt-1">
          {dict.cart.keepShopping}
        </Link>
      </div>
    );
  }

  return (
    <ul className="mb-16 grid list-none gap-3 p-0 sm:mb-20 sm:gap-4">
      {orders.map((order) => {
        const items = order.items ?? [];
        const units = items.reduce((acc, item) => acc + item.qty, 0);
        const thumbs = items.slice(0, MAX_THUMBS);
        const overflow = items.length - thumbs.length;

        return (
          <li
            key={order.id}
            className="overflow-hidden rounded-lg border border-(--hairline) bg-surface shadow-(--shadow-1) transition-colors hover:border-warm"
          >
            {/* Head: identity and status, the two things scanned first */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-(--hairline) px-4 py-3 sm:px-5">
              <span className="font-mono text-sm font-semibold text-ink">{order.orderCode}</span>
              <span className={`chip ${paymentStatusChip(order.paymentStatus)}`}>
                {paymentStatusLabel(order.paymentStatus, dict)}
              </span>
              <span className="ms-auto text-sm text-(--ink-3)">
                {formatOrderDate(order.createdAt, lang)}
              </span>
            </div>

            {/* Body: what was in the order, at a glance */}
            <div className="flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5">
              {thumbs.length > 0 ? (
                <div className="flex items-center gap-2">
                  {thumbs.map((item) => (
                    <div
                      key={item.id}
                      className="aspect-square w-14 overflow-hidden rounded-md bg-(--warm-soft) sm:w-16"
                    >
                      <OrderItemMedia item={item} catalog={catalog} lang={lang} />
                    </div>
                  ))}
                  {overflow > 0 ? (
                    <div className="grid aspect-square w-14 place-items-center rounded-md bg-(--warm-soft) text-sm font-semibold text-(--ink-2) sm:w-16">
                      {(dict.orders.andMore ?? "+{n}").replace("{n}", String(overflow))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="ms-auto text-end">
                {units > 0 ? (
                  <div className="text-sm text-(--ink-3)">{itemsCountLabel(units, dict)}</div>
                ) : null}
                <div className="mt-0.5 text-lg font-semibold text-accent">
                  {formatPrice(order.totalAmount, lang)}
                </div>
              </div>
            </div>

            {/* Foot: the single action this card offers */}
            <div className="border-t border-(--hairline) bg-[color-mix(in_oklch,var(--warm-soft)_45%,transparent)] px-4 py-2.5 text-end sm:px-5">
              <Link
                href={`/${lang}/orders/${order.id}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-ink transition-colors hover:text-accent"
              >
                <span>{dict.orders.viewDetails}</span>
                <Icon.Chevron size={14} className="arrow-flip" />
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
