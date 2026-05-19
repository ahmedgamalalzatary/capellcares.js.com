"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type Language, type OrderSummary } from "@capella/shared";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchCustomerOrders } from "@/lib/api/client";
import { Icon } from "@/components/ui/icons";
import styles from "@/components/wishlist/wishlist.module.css";

export function OrdersView({ lang, dict }: { lang: Language; dict: any }) {
  const { user, accessToken } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    fetchCustomerOrders(accessToken).then((items) => {
      setOrders(items);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [accessToken]);

  if (!user) {
    return (
      <div className={styles.gate}>
        <div className={styles.gateIcon}><Icon.User size={36} /></div>
        <h2 className="display" style={{ fontSize: 26, margin: 0 }}>{dict.orders.loginRequired}</h2>
        <p className="muted" style={{ maxWidth: "44ch" }}>{dict.orders.loginRequiredDesc}</p>
        <Link href={`/${lang}/login`} className="btn btn--primary">{dict.wishlist.goLogin}</Link>
      </div>
    );
  }

  if (loading) return <p className="muted" style={{ padding: 40 }}>{dict.common.loading}</p>;

  if (orders.length === 0) {
    return (
      <div className={styles.gate}>
        <div className={styles.gateIcon}><Icon.Cart size={36} /></div>
        <p className="muted">{dict.orders.empty}</p>
        <Link href={`/${lang}/products`} className="btn btn--ghost">{dict.cart.keepShopping}</Link>
      </div>
    );
  }

  return (
    <div className="card" style={{ overflow: "hidden", marginBottom: 80 }}>
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
              <td><Link href={`/${lang}/orders/${order.id}`} className="btn btn--ghost">{dict.orders.viewDetails}</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
