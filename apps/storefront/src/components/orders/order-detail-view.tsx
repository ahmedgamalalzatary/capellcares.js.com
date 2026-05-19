"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type Language, type Order } from "@capella/shared";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchCustomerOrderById } from "@/lib/api/client";

export function OrderDetailView({ lang, dict, orderId }: { lang: Language; dict: any; orderId: number }) {
  const { accessToken } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    fetchCustomerOrderById(orderId, accessToken).then((value) => {
      setOrder(value);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [accessToken, orderId]);

  if (loading) return <p className="muted" style={{ padding: 40 }}>{dict.common.loading}</p>;
  if (!order) return <p className="muted" style={{ padding: 40 }}>{dict.common.empty}</p>;

  return (
    <div style={{ display: "grid", gap: 16, paddingBottom: 80 }}>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 600 }}>{dict.orders.orderCode}: {order.orderCode}</div>
        <div className="muted">{dict.orders.paymentStatus}: {order.paymentStatus}</div>
        <div className="muted">{dict.common.total}: {order.totalAmount}</div>
        <div style={{ marginTop: 12 }}>
          <Link href={`/${lang}/orders`} className="btn btn--ghost">{dict.orders.backToOrders}</Link>
        </div>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>{dict.cart.item}</th>
              <th>{dict.cart.qty}</th>
              <th>{dict.cart.price}</th>
              <th>{dict.common.total}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{lang === "ar" ? item.snapshotNameAr ?? item.snapshotNameEn : item.snapshotNameEn ?? item.snapshotNameAr}</td>
                <td>{item.qty}</td>
                <td>{item.unitPrice}</td>
                <td>{item.lineTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
