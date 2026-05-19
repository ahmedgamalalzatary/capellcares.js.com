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

  if (!user || authRequired) {
    return (
      <div className="grid place-items-center gap-3 py-20 text-center">
        <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-(--accent-soft) text-accent">
          <Icon.User size={36} />
        </div>
        <h2 className="m-0 text-[26px] font-(--font-display) leading-none">{dict.orders.loginRequired}</h2>
        <p className="max-w-[44ch] text-(--ink-2)">{dict.orders.loginRequiredDesc}</p>
        <Link href={`/${lang}/login`} className="btn btn--primary">
          {dict.wishlist.goLogin}
        </Link>
      </div>
    );
  }

  if (loading) return <p className="py-10 text-(--ink-2)">{dict.common.loading}</p>;

  if (orders.length === 0) {
    return (
      <div className="grid place-items-center gap-3 py-20 text-center">
        <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-(--accent-soft) text-accent">
          <Icon.Cart size={36} />
        </div>
        <p className="text-(--ink-2)">{dict.orders.empty}</p>
        <Link href={`/${lang}/products`} className="btn btn--ghost">
          {dict.cart.keepShopping}
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-20 overflow-hidden rounded-[16px] border border-(--hairline) bg-white">
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
              <td>{order.orderCode}</td>
              <td>{order.paymentStatus}</td>
              <td>{order.totalAmount}</td>
              <td>{new Date(order.createdAt).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US")}</td>
              <td>
                <Link href={`/${lang}/orders/${order.id}`} className="btn btn--ghost">
                  {dict.orders.viewDetails}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

