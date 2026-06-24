"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type Language, type OrderSummary } from "@capella/shared";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchCustomerOrders } from "@/lib/api/client";
import { Icon } from "@/components/ui/icons";

export function OrdersView({ lang, dict }: { lang: Language; dict: any }) {
  const { user, accessToken, logout } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    if (user && !accessToken) {
      setLoading(true);
      return;
    }

    if (!accessToken) {
      setLoading(false);
      return;
    }

    setAuthRequired(false);
    fetchCustomerOrders(accessToken)
      .then((items) => {
        setOrders(items);
        setLoading(false);
      })
      .catch((error) => {
        if (error instanceof Error && error.message.includes("API 401")) {
          setAuthRequired(true);
          logout();
        }
        setLoading(false);
      });
  }, [user, accessToken, logout]);

  const isAr = lang === "ar";

  if (!user || authRequired) {
    return (
      <div className="mx-auto my-10 grid max-w-120 place-items-center gap-4 rounded-lg border border-(--hairline) bg-surface px-6 py-12 text-center sm:my-16 sm:px-8 sm:py-14">
        <div className="grid h-19 w-19 place-items-center rounded-full bg-(--accent-soft) text-accent">
          <Icon.User size={32} />
        </div>
        <h2 className={`m-0 leading-[1.1] ${isAr
          ? "text-2xl font-bold font-(family-name:--font-ar) text-ink"
          : "text-3xl font-(--font-display) text-ink"}`}>
          {dict.orders.loginRequired}
        </h2>
        <p className="max-w-[44ch] text-sm leading-[1.7] text-(--ink-2)">{dict.orders.loginRequiredDesc}</p>
        <Link href={`/${lang}/login`} className="btn btn--primary btn--lg mt-1">
          {dict.wishlist.goLogin}
        </Link>
      </div>
    );
  }

  if (loading) return <p className="py-12 text-center text-(--ink-3)">{dict.common.loading}</p>;

  if (orders.length === 0) {
    return (
      <div className="mx-auto my-10 grid max-w-120 place-items-center gap-4 rounded-lg border border-(--hairline) bg-surface px-6 py-12 text-center sm:my-16 sm:px-8 sm:py-14">
        <div className="grid h-19 w-19 place-items-center rounded-full bg-(--warm-soft) text-ink">
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

  const statusChip = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("paid") || s.includes("delivered") || s.includes("complete")) return "chip--sage";
    if (s.includes("pending") || s.includes("processing")) return "chip--gold";
    if (s.includes("cancel") || s.includes("fail")) return "chip--accent";
    return "";
  };

  return (
    <div className="mb-16 overflow-hidden rounded-lg border border-(--hairline) bg-surface shadow-(--shadow-1) sm:mb-20">
     <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>{dict.orders.orderCode}</th>
            <th>{dict.orders.paymentStatus}</th>
            <th>{dict.common.total}</th>
            <th>{dict.orders.orderDate}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="font-mono text-sm text-ink">{order.orderCode}</td>
              <td><span className={`chip ${statusChip(order.paymentStatus)}`}>{order.paymentStatus}</span></td>
              <td className="text-ink">{order.totalAmount}</td>
              <td className="text-(--ink-2)">{new Date(order.createdAt).toLocaleDateString(isAr ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "numeric" })}</td>
              <td className="text-end">
                <Link href={`/${lang}/orders/${order.id}`} className="btn btn--ghost btn--sm">
                  {dict.orders.viewDetails}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
     </div>
    </div>
  );
}

