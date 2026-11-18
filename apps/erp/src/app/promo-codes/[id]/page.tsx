"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PromoCodeStatusAction } from "@capella/shared";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { PromoCodeDetailView } from "@/features/promos/components/promo-code-detail";
import { PromoCodeReportView } from "@/features/promos/components/promo-code-report";
import type { PromoCodeReport } from "@/features/promos/lib/promo-report";
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
  const [loaded, setLoaded] = useState<PromoCodeDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [loadedReport, setLoadedReport] = useState<{ id: string; report: PromoCodeReport } | null>(null);
  const report = loadedReport?.id === id ? loadedReport.report : null;
  // Only the code named in the URL is ever shown or changed; a late answer for a previous code is ignored.
  const code = loaded && String(loaded.id) === id ? loaded : null;

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    setFailed(false);
    api.get<PromoCodeDetail>(`/api/erp/promo-codes/${encodeURIComponent(id)}`)
      .then((next) => { if (!cancelled) setLoaded(next); })
      .catch((error) => {
        if (cancelled) return;
        setFailed(true);
        showErrorToast(error, "تعذر تحميل الكود.");
      });
    // The report is extra: if it fails the code itself still shows.
    api.get<PromoCodeReport>(`/api/erp/promo-codes/${encodeURIComponent(id)}/report`)
      .then((next) => { if (!cancelled) setLoadedReport({ id, report: next }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [canRead, id, reload]);

  const crumbs = [{ label: "أكواد الخصم", href: "/promo-codes" }, { label: code?.code ?? "…" }];
  if (!canRead) return <ForbiddenPage title="كود الخصم" crumbs={crumbs} message="لا تملكين صلاحية عرض أكواد الخصم." />;

  const changeStatus = async (action: PromoCodeStatusAction) => {
    try {
      await api.post(`/api/erp/promo-codes/${encodeURIComponent(id)}/status`, { action });
      setReload((value) => value + 1);
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
      {code && report ? <div className="mt-5"><PromoCodeReportView report={report} /></div> : null}
    </AdminShell>
  );
}
