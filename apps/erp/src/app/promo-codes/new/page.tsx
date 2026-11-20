"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { PromoCodeForm } from "@/features/promos/components/promo-code-form";
import { promoFormFromCode, type PromoCodeDetail, type PromoFormState } from "@/features/promos/lib/promo-form";
import { usePromoCatalog } from "@/features/promos/lib/use-promo-catalog";
import { api } from "@/lib/api/client";
import { hasErpPermission } from "@/lib/erp-permissions";
import { showErrorToast } from "@/lib/errors";

const crumbs = [{ label: "أكواد الخصم", href: "/promo-codes" }, { label: "كود جديد" }];

function NewPromoCode() {
  const catalog = usePromoCatalog();
  const fromId = useSearchParams().get("from");
  // "Duplicate as new": start from an existing code's rules; the new code gets its own text and schedule.
  const [initial, setInitial] = useState<PromoFormState | null | undefined>(fromId ? undefined : null);

  useEffect(() => {
    if (!fromId) return;
    api.get<PromoCodeDetail>(`/api/erp/promo-codes/${encodeURIComponent(fromId)}`)
      .then((code) => setInitial(promoFormFromCode(code)))
      .catch((error) => { showErrorToast(error, "تعذر تحميل الكود للنسخ."); setInitial(null); });
  }, [fromId]);

  if (initial === undefined) return <p className="text-text-muted">جارٍ التحميل…</p>;
  return <PromoCodeForm catalog={catalog} initial={initial ?? undefined} />;
}

export default function NewPromoCodePage() {
  const { user } = useAdminAuth();
  if (!hasErpPermission(user, "promos.create")) {
    return <ForbiddenPage title="كود جديد" crumbs={crumbs} message="لا تملكين صلاحية إنشاء أكواد الخصم." />;
  }
  return (
    <AdminShell title="كود جديد" crumbs={crumbs}>
      <Suspense fallback={null}><NewPromoCode /></Suspense>
    </AdminShell>
  );
}
