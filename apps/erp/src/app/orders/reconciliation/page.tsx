"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@capella/shared";
import { AdminShell } from "@/components/shell/admin-shell";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { hasErpPermission } from "@/lib/erp-permissions";
import { getStore } from "@/lib/store";

type ReconciliationPayload = Awaited<ReturnType<ReturnType<typeof getStore>["fetchPaymobReconciliation"]>>;
type ReconciliationItem = ReconciliationPayload["items"][number];
type CallbackProblem = ReconciliationPayload["callbackProblems"][number];

const ageLabel = (ageMs: number) => `${Math.max(1, Math.floor(ageMs / 60000))} د`;

export default function PaymobReconciliationPage() {
  const { user } = useAdminAuth();
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [problems, setProblems] = useState<CallbackProblem[]>([]);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const allowed = hasErpPermission(user, "orders.read");
  const canRequeue = hasErpPermission(user, "orders.update_payment_status");

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    void getStore().fetchPaymobReconciliation()
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setProblems(result.callbackProblems);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [allowed, reloadKey]);

  const requeue = async (callbackId: number) => {
    try {
      await getStore().requeuePaymobCallback(callbackId);
      setReloadKey((key) => key + 1);
    } catch {
      setError(true);
    }
  };

  return (
    <AdminShell title="مدفوعات باي موب قيد المراجعة"
      crumbs={[{ label: "الطلبات", href: "/orders" }, { label: "مدفوعات قيد المراجعة" }]}
      actions={<Link href="/orders" className="btn btn--ghost btn--sm">العودة للطلبات</Link>}>
      {!allowed ? <ErpForbiddenState message="ليس لديك صلاحية عرض الطلبات." /> : (
        <div className="stack stack--lg">
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
          {problems.length > 0 && (
            <div className="card card--pad-lg">
              <h2 className="card__title">إشعارات دفع معلّقة</h2>
              <p>هذه إشعارات دفع محفوظة لم تكتمل معالجتها (استرداد أو ربط غير مؤكد). إعادة المحاولة تعيد معالجة نفس الإشعار المحفوظ دون أي إرسال جديد إلى باي موب.</p>
              <div className="table-outer"><table className="table"><thead><tr>
                <th>مرجع الطلب</th><th>العميل</th><th>السبب</th><th>العمر</th><th>البيئة</th>
                {canRequeue && <th>إجراء</th>}
              </tr></thead><tbody>{problems.map((problem) => <tr key={problem.callbackId}>
                <td><code>{problem.checkoutId ?? problem.paymobOrderId ?? `#${problem.callbackId}`}</code></td>
                <td>{problem.customerName ?? "—"}
                  {problem.customerEmail ? <div className="muted fs-12-5">{problem.customerEmail}</div> : null}</td>
                <td>{problem.reason ?? "—"}</td>
                <td>{ageLabel(problem.ageMs)}</td>
                <td>{problem.environment ?? "—"}</td>
                {canRequeue && <td>
                  <button type="button" className="btn btn--ghost btn--sm"
                    onClick={() => void requeue(problem.callbackId)}>إعادة المحاولة</button>
                </td>}
              </tr>)}</tbody></table></div>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
