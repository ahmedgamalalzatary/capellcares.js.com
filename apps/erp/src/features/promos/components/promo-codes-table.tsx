"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableState, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { describePromoBenefits, PROMO_STATUS_LABELS, PROMO_STATUS_TONES, type PromoCodeSummary } from "../lib/promo-form";
import { formatPromoDateTime } from "./promo-code-detail";

export function PromoCodesTable({ codes, loading }: { codes: PromoCodeSummary[]; loading: boolean }) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>الكود</TH>
          <TH>المزايا</TH>
          <TH>الحالة</TH>
          <TH>المدة</TH>
          <TH>الاستخدام</TH>
        </TR>
      </THead>
      <TBody>
        {loading ? <TableState colSpan={5}>جارٍ التحميل…</TableState> : null}
        {!loading && codes.length === 0 ? <TableState colSpan={5}>لا توجد أكواد بعد.</TableState> : null}
        {!loading && codes.map((code) => (
          <TR key={code.id}>
            <TD>
              <Link href={`/promo-codes/${code.id}`} className="font-medium text-text-strong underline-offset-4 hover:underline" dir="ltr">{code.code}</Link>
              <span className="block text-sm text-text-muted">{code.arName}</span>
            </TD>
            <TD>{describePromoBenefits(code).join(" + ")}</TD>
            <TD><Badge tone={PROMO_STATUS_TONES[code.status]}>{PROMO_STATUS_LABELS[code.status]}</Badge></TD>
            <TD className="text-sm">
              {formatPromoDateTime(code.startsAt)}
              <span className="block text-text-muted">{code.endsAt ? `حتى ${formatPromoDateTime(code.endsAt)}` : "حتى الإيقاف"}</span>
            </TD>
            <TD className="num">{code.totalUsageLimit !== null ? `${formatNumber(code.usage.used)} / ${formatNumber(code.totalUsageLimit)}` : formatNumber(code.usage.used)}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
