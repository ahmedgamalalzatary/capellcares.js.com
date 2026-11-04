"use client";

import { useEffect, useState } from "react";
import { Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import type { DeliveryGovernorate } from "@capella/shared";
import { AdminShell } from "@/components/shell/admin-shell";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { moveItem } from "@/lib/array";
import { canReadErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { draftError, fromSettings, newGovernorate, toPayload, type DraftGovernorate } from "@/features/delivery/lib/delivery-draft";
import { GovernorateCard } from "@/features/delivery/components/governorate-card";

type Settings = { governorates: DeliveryGovernorate[] };

export default function DeliveryPage() {
  const { user } = useAdminAuth();
  const canRead = canReadErpModule(user, "delivery");
  const canEdit = canUpdateErpModule(user, "delivery");
  const [draft, setDraft] = useState<DraftGovernorate[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    api.get<Settings>("/api/erp/delivery")
      .then((settings) => { if (!cancelled) setDraft(fromSettings(settings.governorates)); })
      .catch(() => { if (!cancelled) setError("تعذر تحميل إعدادات التوصيل. حدّثي الصفحة وحاولي مرة أخرى."); });
    return () => { cancelled = true; };
  }, [canRead]);

  if (!canRead) {
    return <ForbiddenPage title="التوصيل" crumbs={[{ label: "التوصيل" }]} message="لا تملكين صلاحية الوصول إلى إعدادات التوصيل." />;
  }

  const update = (updater: (current: DraftGovernorate[]) => DraftGovernorate[]) => {
    setDraft((current) => (current ? updater(current) : current));
    setDirty(true);
  };

  const toggleCollapsed = (key: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const save = async () => {
    if (!draft) return;
    const problem = draftError(draft);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const saved = await api.put<Settings>("/api/erp/delivery", toPayload(draft));
      setDraft(fromSettings(saved.governorates));
      setDirty(false);
      toast.success("تم حفظ إعدادات التوصيل.");
    } catch {
      setError("تعذر حفظ إعدادات التوصيل. حاولي مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  const addGovernorate = () => update((current) => [...current, newGovernorate()]);

  return (
    <AdminShell
      title="التوصيل"
      crumbs={[{ label: "التوصيل" }]}
      description="المحافظات والمناطق التي يوصل إليها المتجر ورسوم التوصيل لكل منطقة. تظهر في صفحة الدفع المحافظات النشطة التي بها منطقة نشطة فقط."
      actions={canEdit && draft ? (
        <div className="flex flex-wrap items-center gap-3">
          {dirty ? <span className="text-xs font-medium text-warning">تغييرات غير محفوظة</span> : null}
          <Button variant="secondary" size="sm" onClick={addGovernorate}><Plus /> إضافة محافظة</Button>
          <Button variant="primary" size="sm" disabled={saving || !dirty} onClick={() => { void save(); }}>
            {saving ? "جارٍ الحفظ…" : "حفظ التوصيل"}
          </Button>
        </div>
      ) : null}
    >
      <div className="grid gap-5">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {draft === null ? (
          error ? null : <Card><div role="status" aria-label="جارٍ التحميل" className="p-6"><FormSkeleton /></div></Card>
        ) : draft.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Truck />}
              title="لا توجد محافظات بعد"
              description="أضيفي المحافظات ومناطقها ورسوم التوصيل لكل منطقة. لا يمكن للعملاء إتمام الطلب قبل إضافة منطقة نشطة واحدة على الأقل."
              action={canEdit ? <Button variant="primary" size="sm" onClick={addGovernorate}><Plus /> إضافة محافظة</Button> : undefined}
            />
          </Card>
        ) : draft.map((governorate, index) => (
          <GovernorateCard
            key={governorate.key}
            governorate={governorate}
            index={index}
            count={draft.length}
            canEdit={canEdit}
            collapsed={collapsed.has(governorate.key)}
            onToggleCollapsed={() => toggleCollapsed(governorate.key)}
            onChange={(next) => update((current) => current.map((entry) => (entry.key === governorate.key ? next : entry)))}
            onMove={(i, delta) => update((current) => moveItem(current, i, delta))}
            onRemove={() => update((current) => current.filter((entry) => entry.key !== governorate.key))}
          />
        ))}
      </div>
    </AdminShell>
  );
}
