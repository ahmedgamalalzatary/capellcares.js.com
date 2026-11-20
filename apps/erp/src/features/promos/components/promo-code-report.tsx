"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney, formatNumber } from "@/lib/format";
import { percent, RELEASE_REASON_LABELS, type PromoCodeReport } from "../lib/promo-report";
import { formatPromoDateTime } from "./promo-code-detail";

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="num text-lg text-text-strong">{children}</dd>
    </div>
  );
}

const money = (cents: number) => formatMoney(cents / 100);

/** One code's report (spec section 9.3): uses, money, customers, orders and health, all built from the orders that used it. */
export function PromoCodeReportView({ report }: { report: PromoCodeReport }) {
  const { uses, customers, orders, health } = report;
  return (
    <div className="grid gap-5">
      <Card aria-label="الاستخدام">
        <CardHeader title="الاستخدام" />
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Figure label="مستخدم">{formatNumber(uses.used)}</Figure>
            <Figure label="محجوز الآن">{formatNumber(uses.reserved)}</Figure>
            <Figure label="أُعيد">{formatNumber(uses.released)}</Figure>
            <Figure label="المتبقي">{uses.remaining === null ? "بلا حد" : formatNumber(uses.remaining)}</Figure>
            <Figure label="بعد انتهاء الحجز">{formatNumber(uses.overLimit)}</Figure>
          </dl>
        </CardBody>
      </Card>

      <Card aria-label="الأرقام المالية">
        <CardHeader title="الأرقام المالية" description="من الطلبات التي ما زالت تستخدم الكود." />
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label="الإيراد بعد الاستردادات">{money(report.money.revenueCents)}</Figure>
            <Figure label="إجمالي الخصم">{money(report.money.discountCents)}</Figure>
            <Figure label="تكلفة التوصيل المجاني">{money(report.money.shippingAbsorbedCents)}</Figure>
            <Figure label="تكلفة الهدايا">{money(report.money.giftCostCents)}</Figure>
            <Figure label="تخفيضات استبدلها الكود">{money(report.money.saleGivenUpCents)}</Figure>
            <Figure label="متوسط الطلب بالكود">{money(report.money.averageOrderCents)}</Figure>
            <Figure label="متوسط الطلب في المتجر">{money(report.money.storeAverageCents)}</Figure>
          </dl>
        </CardBody>
      </Card>

      <Card aria-label="العملاء">
        <CardHeader title="العملاء" />
        <CardBody className="grid gap-4">
          <dl className="grid grid-cols-2 gap-4">
            <Figure label="عملاء جدد">{formatNumber(customers.newVsReturning.newCustomers)}</Figure>
            <Figure label="عملاء سابقون">{formatNumber(customers.newVsReturning.returningCustomers)}</Figure>
          </dl>
          {customers.byCustomer.length > 0 ? (
            <Table>
              <THead><TR><TH>العميل</TH><TH>الهاتف</TH><TH>الاستخدامات</TH><TH>الطلبات</TH><TH>الإنفاق</TH></TR></THead>
              <TBody>
                {customers.byCustomer.map((row) => (
                  <TR key={`${row.customerId ?? "guest"}-${row.phone}`}>
                    <TD data-cell="lead">{row.name}</TD>
                    <TD data-label="الهاتف"><span dir="ltr" className="num">{row.phone}</span></TD>
                    <TD data-label="الاستخدامات" className="num">{formatNumber(row.uses)}</TD>
                    <TD data-label="الطلبات" className="num">{formatNumber(row.orders)}</TD>
                    <TD data-label="الإنفاق" className="num">{money(row.spentCents)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : null}
        </CardBody>
      </Card>

      <Card aria-label="الطلبات">
        <CardHeader title="الطلبات" />
        <CardBody>
          {orders.length === 0 ? (
            <p className="text-text-muted">لم يُستخدم الكود في أي طلب بعد.</p>
          ) : (
            <Table>
              <THead><TR><TH>الطلب</TH><TH>العميل</TH><TH>التاريخ</TH><TH>الإجمالي</TH><TH>الكود</TH></TR></THead>
              <TBody>
                {orders.map((order) => (
                  <TR key={order.id}>
                    <TD data-cell="lead"><Link href={`/orders/${order.id}`} className="font-medium text-text-strong underline-offset-4 hover:underline">{order.orderCode}</Link></TD>
                    <TD data-label="العميل">{order.customerName}</TD>
                    <TD data-label="التاريخ">{formatPromoDateTime(order.createdAt)}</TD>
                    <TD data-label="الإجمالي" className="num">{formatMoney(order.totalAmount)}</TD>
                    <TD data-label="الكود">
                      {order.useState === "released"
                        ? <Badge tone="neutral" swatch={false}>{`أُعيد (${RELEASE_REASON_LABELS[order.releaseReason ?? ""] ?? "—"})`}</Badge>
                        : order.overLimit ? <Badge tone="warning" swatch={false}>مستخدم بعد انتهاء الحجز</Badge>
                          : <Badge tone="success" swatch={false}>مستخدم</Badge>}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card aria-label="المؤشرات">
        <CardHeader title="المؤشرات" />
        <CardBody className="grid gap-4">
          <dl className="grid grid-cols-2 gap-4">
            <Figure label="نسبة الإلغاء والرفض">{percent(health.cancelled)}</Figure>
            <Figure label="نسبة الاسترداد">{percent(health.refunded)}</Figure>
          </dl>
          {health.usageByDay.length > 0 ? (
            <ul aria-label="الاستخدام حسب اليوم" className="grid gap-1 text-sm">
              {health.usageByDay.map((day) => (
                <li key={day.date} className="flex justify-between rounded-control bg-sunken px-3 py-2">
                  <span className="num" dir="ltr">{day.date}</span>
                  <span className="num">{formatNumber(day.uses)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
