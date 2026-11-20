"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { PromoCodesTable } from "@/features/promos/components/promo-codes-table";
import type { PromoCodeSummary } from "@/features/promos/lib/promo-form";
import { api } from "@/lib/api/client";
import { hasErpPermission } from "@/lib/erp-permissions";
import { showErrorToast } from "@/lib/errors";

export default function PromoCodesPage() {
  const { user } = useAdminAuth();
  const canRead = hasErpPermission(user, "promos.read");
  const [status, setStatus] = useState("");
  const [codes, setCodes] = useState<PromoCodeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    setLoading(true);
    api.get<{ items: PromoCodeSummary[] }>(`/api/erp/promo-codes${status ? `?status=${status}` : ""}`)
      .then((response) => { if (!cancelled) setCodes(response.items); })
      .catch((error) => showErrorToast(error, "تعذر تحميل أكواد الخصم."))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [canRead, status]);

  if (!canRead) {
    return <ForbiddenPage title="أكواد الخصم" crumbs={[{ label: "أكواد الخصم" }]} message="لا تملكين صلاحية عرض أكواد الخصم." />;
  }

  return (
    <AdminShell
      title="أكواد الخصم"
      crumbs={[{ label: "أكواد الخصم" }]}
      description="أكواد يكتبها العميل في السلة للحصول على خصم أو توصيل مجاني أو هدية."
      actions={hasErpPermission(user, "promos.create") ? (
        <Button asChild variant="primary"><Link href="/promo-codes/new"><Plus aria-hidden /> كود جديد</Link></Button>
      ) : undefined}
    >
      <div className="grid gap-4">
        <Field label="الحالة" htmlFor="promo-status-filter" className="max-w-56">
          <Select id="promo-status-filter" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="paused">متوقف مؤقتًا</option>
            <option value="stopped">منتهٍ</option>
          </Select>
        </Field>
        <Card><PromoCodesTable codes={codes} loading={loading} /></Card>
      </div>
    </AdminShell>
  );
}
