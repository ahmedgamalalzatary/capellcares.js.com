"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@capella/shared";
import { AdminShell } from "@/components/shell/admin-shell";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { hasErpPermission } from "@/lib/erp-permissions";
import { getStore } from "@/lib/store";

type ReconciliationItem = Awaited<ReturnType<ReturnType<typeof getStore>["fetchPaymobReconciliation"]>>[number];

export default function PaymobReconciliationPage() {
  const { user } = useAdminAuth();
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [error, setError] = useState(false);
  const allowed = hasErpPermission(user, "orders.read");

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    void getStore().fetchPaymobReconciliation()
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [allowed]);

  return (
    <AdminShell title="مدفوعات باي موب قيد المراجعة"
      crumbs={[{ label: "الطلبات", href: "/orders" }, { label: "مدفوعات قيد المراجعة" }]}
      actions={<Link href="/orders" className="btn btn--ghost btn--sm">العودة للطلبات</Link>}>
      {!allowed ? <ErpForbiddenState message="ليس لديك صلاحية عرض الطلبات." /> : (
        <div className="card card--pad-lg">
          <p>هذه المدفوعات تأكدت بعد انتهاء حجز المنتجات. راجعي كل معاملة في لوحة باي موب وتواصلي مع العميل قبل أي رد مبلغ أو تنفيذ يدوي. لا تنشئي طلبًا تلقائيًا.</p>
          {error ? <p role="alert">تعذر تحميل المدفوعات. حدّثي الصفحة للمحاولة مرة أخرى.</p> :
            items.length === 0 ? <p>لا توجد مدفوعات تحتاج إلى مراجعة.</p> : (
              <div className="table-outer"><table className="table"><thead><tr>
                <th>مرجع الدفع</th><th>العميل</th><th>المبلغ</th><th>رقم معاملة باي موب</th><th>البيئة</th>
              </tr></thead><tbody>{items.map((item) => <tr key={item.checkoutId}>
                <td><code>{item.checkoutId}</code></td>
                <td>{item.customerName}<div className="muted fs-12-5">{item.customerEmail}</div></td>
                <td>{formatPrice(item.amountCents / 100, "ar")}</td>
                <td>{item.paymobTransactionId ?? "—"}</td>
                <td>{item.environment}</td>
              </tr>)}</tbody></table></div>
            )}
        </div>
      )}
    </AdminShell>
  );
}
