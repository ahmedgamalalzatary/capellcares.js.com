"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { AdminShell } from "@/components/shell/admin-shell";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney, formatNumber } from "@/lib/format";
import { hasErpPermission } from "@/lib/erp-permissions";
import { getStore } from "@/lib/store";
import type { PaymobCallbackProblem as CallbackProblem, PaymobReconciliationItem as ReconciliationItem } from "@/lib/store/types";

const ageLabel = (ageMs: number) => `${formatNumber(Math.max(1, Math.floor(ageMs / 60000)))} د`;

export default function PaymobReconciliationPage() {
  const { user } = useAdminAuth();
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [problems, setProblems] = useState<CallbackProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const allowed = hasErpPermission(user, "orders.read");
  const canRequeue = hasErpPermission(user, "orders.update_payment_status");

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setLoading(true);
    void getStore().fetchPaymobReconciliation()
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setProblems(result.callbackProblems);
        setError(false);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
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
    <AdminShell
      title="مدفوعات باي موب قيد المراجعة"
      crumbs={[{ label: "الطلبات", href: "/orders" }, { label: "مدفوعات قيد المراجعة" }]}
      actions={
        <Button asChild variant="secondary">
          <Link href="/orders">العودة للطلبات</Link>
        </Button>
      }
    >
      {!allowed ? <ErpForbiddenState message="ليس لديك صلاحية عرض الطلبات." /> : (
        <div className="grid gap-5">
          <Card>
            <CardBody className="grid gap-4 pt-5 sm:pt-6">
              {error ? <Alert tone="danger">تعذر تحميل المدفوعات. حدّثي الصفحة للمحاولة مرة أخرى.</Alert> : null}
              {!error ? (
                <Alert tone="info">
                  هذه المدفوعات تأكدت بعد انتهاء حجز المنتجات. راجعي كل معاملة في لوحة باي موب وتواصلي مع العميل قبل أي رد مبلغ أو تنفيذ يدوي. لا تنشئي طلبًا تلقائيًا.
                </Alert>
              ) : null}
              {loading ? (
                <div className="grid gap-2" aria-hidden>
                  {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-11 rounded-control" />)}
                </div>
              ) : items.length === 0 && !error ? (
                <EmptyState icon={<ReceiptText />} title="لا توجد مدفوعات تحتاج إلى مراجعة" description="كل المدفوعات المتأخرة تمت معالجتها." className="py-10" />
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <TH>مرجع الدفع</TH>
                      <TH>العميل</TH>
                      <TH>المبلغ</TH>
                      <TH>رقم معاملة باي موب</TH>
                      <TH>البيئة</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {items.map((item) => (
                      <TR key={item.checkoutId}>
                        <TD data-cell="lead" className="text-text-strong"><code className="mono text-sm">{item.checkoutId}</code></TD>
                        <TD data-label="العميل">
                          <span className="block text-text-strong">{item.customerName}</span>
                          <span dir="ltr" className="block text-end text-sm text-text-muted">{item.customerEmail}</span>
                        </TD>
                        <TD data-label="المبلغ" className="num whitespace-nowrap font-medium text-text-strong">{formatMoney(item.amountCents / 100)}</TD>
                        <TD data-label="رقم معاملة باي موب" className="whitespace-nowrap text-text-2"><bdi>{item.paymobTransactionId ?? "—"}</bdi></TD>
                        <TD data-label="البيئة" className="text-text-2">{item.environment}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>

          {problems.length > 0 ? (
            <Card>
              <CardHeader
                title="إشعارات دفع معلّقة"
                description="إشعارات دفع محفوظة لم تكتمل معالجتها. إعادة المحاولة تعيد معالجة نفس الإشعار المحفوظ دون أي إرسال جديد إلى باي موب."
              />
              <Table>
                <THead>
                  <tr>
                    <TH>مرجع الطلب</TH>
                    <TH>العميل</TH>
                    <TH>السبب</TH>
                    <TH>العمر</TH>
                    <TH>البيئة</TH>
                    {canRequeue ? <TH><span className="sr-only">إجراء</span></TH> : null}
                  </tr>
                </THead>
                <TBody>
                  {problems.map((problem) => (
                    <TR key={problem.callbackId}>
                      <TD data-cell="lead" className="text-text-strong">
                        <code className="mono text-sm">{problem.checkoutId ?? problem.paymobOrderId ?? `#${problem.callbackId}`}</code>
                      </TD>
                      <TD data-label="العميل">
                        <span className="block text-text-strong">{problem.customerName ?? "—"}</span>
                        {problem.customerEmail ? <span dir="ltr" className="block text-end text-sm text-text-muted">{problem.customerEmail}</span> : null}
                      </TD>
                      <TD data-label="السبب" className="text-text-2">{problem.reason ?? "—"}</TD>
                      <TD data-label="العمر" className="num whitespace-nowrap text-text-2">{ageLabel(problem.ageMs)}</TD>
                      <TD data-label="البيئة" className="text-text-2">{problem.environment ?? "—"}</TD>
                      {canRequeue ? (
                        <TD data-cell="actions">
                          <div className="flex justify-end">
                            <Button variant="secondary" size="sm" onClick={() => { void requeue(problem.callbackId); }}>إعادة المحاولة</Button>
                          </div>
                        </TD>
                      ) : null}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          ) : null}
        </div>
      )}
    </AdminShell>
  );
}
