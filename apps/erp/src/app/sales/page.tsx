"use client";

import { formatPrice } from "@capella/shared";
import { AdminShell } from "@/components/shell/admin-shell";
import { paymentStatusChip, paymentStatusLabel } from "@/lib/payment-status";
import { useStore } from "@/lib/store";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("ar-EG", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default function SalesPage() {
  const sales = useStore((s) => s.sales);

  return (
    <AdminShell title="المبيعات" crumbs={[{ label: "المبيعات" }]}>
      <div className="grid sales-grid sales-grid--3">
        <div className="card">
          <div className="card__body">
            <div className="muted">إجمالي الطلبات</div>
            <div className="page-title sales-metric">{sales.summary.totalOrders}</div>
          </div>
        </div>
        <div className="card">
          <div className="card__body">
            <div className="muted">إجمالي الوحدات</div>
            <div className="page-title sales-metric">{sales.summary.totalUnitsSold}</div>
          </div>
        </div>
        <div className="card">
          <div className="card__body">
            <div className="muted">إجمالي الإيراد</div>
            <div className="page-title sales-metric">{formatPrice(sales.summary.totalRevenue, "ar")}</div>
          </div>
        </div>
      </div>

      <div className="grid sales-grid sales-grid--2 sales-grid--spaced">
        <div className="card">
          <div className="card__head"><h3 className="card__title">أفضل المنتجات</h3></div>
          <div className="table-outer">
            <table className="table">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>الوحدات</th>
                  <th>الإيراد</th>
                </tr>
              </thead>
              <tbody>
                {sales.productTotals.map((item) => (
                  <tr key={item.productId}>
                    <td>{item.productName}</td>
                    <td>{item.unitsSold}</td>
                    <td>{formatPrice(item.revenue, "ar")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card__head"><h3 className="card__title">أفضل المتغيرات</h3></div>
          <div className="table-outer">
            <table className="table">
              <thead>
                <tr>
                  <th>المتغير</th>
                  <th>الوحدات</th>
                  <th>الإيراد</th>
                </tr>
              </thead>
              <tbody>
                {sales.variantTotals.map((item) => (
                  <tr key={item.variantId}>
                    <td>{item.productName} / {item.variantLabel}</td>
                    <td>{item.unitsSold}</td>
                    <td>{formatPrice(item.revenue, "ar")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card card--spaced-top">
        <div className="card__head"><h3 className="card__title">تفصيل الطلبات</h3></div>
        <div className="table-outer">
          <table className="table">
            <thead>
              <tr>
                <th>كود الطلب</th>
                <th>الحالة</th>
                <th>الإجمالي</th>
                <th>الوحدات</th>
                <th>العناصر</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {sales.orders.map((order) => (
                <tr key={order.orderId}>
                  <td>{order.orderCode}</td>
                  <td><span className={paymentStatusChip[order.paymentStatus]}>{paymentStatusLabel[order.paymentStatus]}</span></td>
                  <td>{formatPrice(order.totalAmount, "ar")}</td>
                  <td>{order.unitsSold}</td>
                  <td>
                    <div className="stack">
                      {order.items.map((item, index) => (
                        <div key={`${order.orderId}-${index}`}>{item.label} x{item.unitsSold}</div>
                      ))}
                    </div>
                  </td>
                  <td>{formatDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
