"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Copy, Pause, Play, Square } from "lucide-react";
import type { PromoCodeStatusAction } from "@capella/shared";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatMoney, formatNumber } from "@/lib/format";
import type { PromoCatalog } from "../lib/promo-catalog";
import {
  describePromoBenefits,
  PROMO_EVENT_LABELS,
  PROMO_STATUS_LABELS,
  PROMO_STATUS_TONES,
  type PromoCodeDetail
} from "../lib/promo-form";

export function formatPromoDateTime(value: string) {
  return new Date(value).toLocaleString("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-base text-text-strong">{children}</dd>
    </div>
  );
}

export function PromoCodeDetailView({
  code,
  catalog,
  canUpdateStatus,
  canCreate,
  onStatusChange
}: {
  code: PromoCodeDetail;
  catalog: PromoCatalog;
  canUpdateStatus: boolean;
  canCreate: boolean;
  onStatusChange: (action: PromoCodeStatusAction) => Promise<void>;
}) {
  const [confirmStop, setConfirmStop] = useState(false);
  const [busy, setBusy] = useState(false);
  const change = async (action: PromoCodeStatusAction) => {
    setBusy(true);
    try {
      await onStatusChange(action);
    } finally {
      setBusy(false);
      setConfirmStop(false);
    }
  };

  const rules: string[] = [];
  if (code.minOrderAmount !== null) rules.push(`الحد الأدنى للطلب ${formatMoney(code.minOrderAmount)}`);
  if (code.maxOrderAmount !== null) rules.push(`الحد الأقصى للطلب ${formatMoney(code.maxOrderAmount)}`);
  if (code.minEligiblePieces !== null) rules.push(`على الأقل ${formatNumber(code.minEligiblePieces)} قطع مشمولة`);
  if (code.maxDiscountedPieces !== null) rules.push(`يخفض حتى ${formatNumber(code.maxDiscountedPieces)} قطع (الأغلى أولًا)`);
  if (code.perCustomerLimit !== null) rules.push(`حتى ${formatNumber(code.perCustomerLimit)} مرة لكل عميل`);
  if (code.firstOrderOnly) rules.push("للطلب الأول فقط");
  if (code.isPrivate) rules.push("كود خاص بعملاء محددين");

  const actions = (
    <>
      {canUpdateStatus && code.status === "active" ? (
        <Button variant="secondary" disabled={busy} onClick={() => void change("pause")}><Pause aria-hidden /> إيقاف مؤقت</Button>
      ) : null}
      {canUpdateStatus && code.status === "paused" ? (
        <Button variant="secondary" disabled={busy} onClick={() => void change("resume")}><Play aria-hidden /> استئناف</Button>
      ) : null}
      {canUpdateStatus && code.status !== "stopped" ? (
        <Button variant="danger" disabled={busy} onClick={() => setConfirmStop(true)}><Square aria-hidden /> إنهاء الكود</Button>
      ) : null}
      {canCreate ? (
        <Button asChild variant="ghost"><Link href={`/promo-codes/new?from=${code.id}`}><Copy aria-hidden /> نسخ ككود جديد</Link></Button>
      ) : null}
    </>
  );

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader
          title={<span className="flex flex-wrap items-center gap-3"><span dir="ltr">{code.code}</span><Badge tone={PROMO_STATUS_TONES[code.status]}>{PROMO_STATUS_LABELS[code.status]}</Badge></span>}
          description={`${code.arName} · ${code.enName}`}
          actions={actions}
        />
        <CardBody>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Row label="المزايا">
              <ul>{describePromoBenefits(code).map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
            </Row>
            <Row label="يبدأ">{formatPromoDateTime(code.startsAt)}</Row>
            <Row label="ينتهي">{code.endsAt ? formatPromoDateTime(code.endsAt) : "حتى الإيقاف"}</Row>
            <Row label="الاستخدام">
              <span className="num">{code.totalUsageLimit !== null ? `${formatNumber(code.usage.used)} / ${formatNumber(code.totalUsageLimit)}` : formatNumber(code.usage.used)}</span>
            </Row>
          </dl>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="المنتجات المشمولة" />
          <CardBody className="grid gap-3 text-base">
            <p>{code.eligibility.scope === "all" ? "كل المتجر" : "أقسام أو منتجات محددة"}</p>
            {code.eligibility.include.length > 0 ? (
              <ul className="grid gap-1">{code.eligibility.include.map((target) => <li key={`${target.type}:${target.id}`}>{catalog.targetLabel(target)}</li>)}</ul>
            ) : null}
            {code.eligibility.exclude.length > 0 ? (
              <div className="grid gap-1">
                <span className="text-sm text-text-muted">مستثنى:</span>
                <ul className="grid gap-1">{code.eligibility.exclude.map((target) => <li key={`${target.type}:${target.id}`}>{catalog.targetLabel(target)}</li>)}</ul>
              </div>
            ) : null}
            {code.gift ? (
              <div className="grid gap-1">
                <span className="text-sm text-text-muted">الهدية:</span>
                <span>{`${catalog.giftLabel(code.gift.itemType, code.gift.itemId)} × ${formatNumber(code.gift.qty)}`}</span>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="الشروط" />
          <CardBody>
            {rules.length > 0 ? <ul className="grid gap-1 text-base">{rules.map((rule) => <li key={rule}>{rule}</li>)}</ul> : <p className="text-text-muted">بدون شروط إضافية.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="الاستخدام" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-4">
              <Row label="مستخدم"><span className="num">{formatNumber(code.usage.used)}</span></Row>
              <Row label="محجوز الآن (دفع أونلاين)"><span className="num">{formatNumber(code.usage.reserved)}</span></Row>
              <Row label="أُعيد (إلغاء أو فشل دفع)"><span className="num">{formatNumber(code.usage.released)}</span></Row>
              <Row label="فوق الحد (دفع متأخر)"><span className="num">{formatNumber(code.usage.overLimit)}</span></Row>
            </dl>
          </CardBody>
        </Card>

        {code.isPrivate ? (
          <Card>
            <CardHeader title={`العملاء (${formatNumber(code.customers.length)})`} />
            <CardBody>
              <ul className="grid gap-1 text-base">
                {code.customers.map((customer) => <li key={customer.id}>{customer.name} <span dir="ltr" className="text-text-muted">{customer.email}</span></li>)}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="سجل التغييرات" />
          <CardBody>
            <ul className="grid gap-2 text-base">
              {code.events.map((event, index) => (
                <li key={index} className="flex flex-wrap justify-between gap-2">
                  <span>{PROMO_EVENT_LABELS[event.action]}</span>
                  <span className="text-sm text-text-muted">{event.adminName ?? "—"} · {formatPromoDateTime(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <AdminConfirmModal
        open={confirmStop}
        title="إنهاء الكود"
        confirmLabel="إنهاء"
        tone="danger"
        disableConfirm={busy}
        onClose={() => setConfirmStop(false)}
        onConfirm={() => change("stop")}
      >
        <p>لا يمكن إعادة تشغيل الكود بعد إنهائه.</p>
      </AdminConfirmModal>
    </div>
  );
}
