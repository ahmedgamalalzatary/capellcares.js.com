"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { PromoCodeStatusAction } from "@capella/shared";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { PromoCodeDetailView } from "@/features/promos/components/promo-code-detail";
import { promoErrorMessage, type PromoCodeDetail } from "@/features/promos/lib/promo-form";
import { usePromoCatalog } from "@/features/promos/lib/use-promo-catalog";
import { api } from "@/lib/api/client";
import { hasErpPermission } from "@/lib/erp-permissions";
import { showErrorToast } from "@/lib/errors";

export default function PromoCodeDetailPage() {
  const { user } = useAdminAuth();
  const { id } = useParams<{ id: string }>();
  const catalog = usePromoCatalog();
  const canRead = hasErpPermission(user, "promos.read");
  const [code, setCode] = useState<PromoCodeDetail | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setCode(await api.get<PromoCodeDetail>(`/api/erp/promo-codes/${encodeURIComponent(id)}`));
    } catch (error) {
      setFailed(true);
      showErrorToast(error, "تعذر تحميل الكود.");
    }
  }, [id]);

  useEffect(() => {
    if (canRead) void load();
  }, [canRead, load]);

  const crumbs = [{ label: "أكواد الخصم", href: "/promo-codes" }, { label: code?.code ?? "…" }];
  if (!canRead) return <ForbiddenPage title="كود الخصم" crumbs={crumbs} message="لا تملكين صلاحية عرض أكواد الخصم." />;

  const changeStatus = async (action: PromoCodeStatusAction) => {
    try {
      await api.post(`/api/erp/promo-codes/${encodeURIComponent(id)}/status`, { action });
      await load();
    } catch (error) {
      const key = (error as { body?: { errors?: string[] } })?.body?.errors?.[0];
      showErrorToast(error, key ? promoErrorMessage(key) : "تعذر تغيير حالة الكود.");
    }
  };

  return (
    <AdminShell title={code?.code ?? "كود الخصم"} crumbs={crumbs}>
      {code ? (
        <PromoCodeDetailView
          code={code}
          catalog={catalog}
          canUpdateStatus={hasErpPermission(user, "promos.update_status")}
          canCreate={hasErpPermission(user, "promos.create")}
          onStatusChange={changeStatus}
        />
      ) : <p className="text-text-muted">{failed ? "تعذر تحميل الكود." : "جارٍ التحميل…"}</p>}
    </AdminShell>
  );
}
