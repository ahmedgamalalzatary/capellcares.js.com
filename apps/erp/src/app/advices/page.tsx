"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, CircleDot, Plus } from "lucide-react";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ACTIVE_STATUS_FILTER_OPTIONS, AdminListHeader } from "@/components/admin/admin-list-header";
import { tableSortSelect } from "@/components/admin/list-table";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Button } from "@/components/ui/button";
import { ADVICE_SORT_COLUMNS, AdvicesTable } from "@/features/advices/components/advices-table";
import type { Advice } from "@capella/shared";
import { canCreateErpModule, canReadErpModule, canToggleErpModule, canUpdateErpModule, hasErpPermission } from "@/lib/erp-permissions";
import { formatNumber } from "@/lib/format";
import { getStore, useStore } from "@/lib/store";
import { sortByIdOrder, useListReorder } from "@/hooks/use-list-reorder";
import { useTableSort } from "@/hooks/use-table-sort";

export default function AdvicesPage() {
  const { user } = useAdminAuth();
  const advices = useStore((s) => s.advices);
  const loaded = useStore((s) => s.loaded);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [pendingToggle, setPendingToggle] = useState<Advice | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Advice | null>(null);
  const reorder = useListReorder({
    persistedIds: useMemo(() => advices.map((advice) => advice.id), [advices]),
    save: (ids) => getStore().reorderAdvices({ ids }),
    successMessage: "تم حفظ ترتيب النصائح.",
    errorMessage: "تعذر حفظ ترتيب النصائح. حاولي مرة أخرى."
  });
  const canReorder = canUpdateErpModule(user, "advices") && !search.trim() && statusFilter === "all";

  const filtered = useMemo(() => {
    const ordered = sortByIdOrder(advices, reorder.orderedIds)
      .filter((advice) => statusFilter === "all" || advice.status === statusFilter);
    if (!search.trim()) return ordered;
    const term = search.trim().toLowerCase();
    return ordered.filter((advice) => advice.title.ar.toLowerCase().includes(term) || advice.title.en.toLowerCase().includes(term));
  }, [advices, reorder.orderedIds, search, statusFilter]);

  const { sort, setSort, toggleSort, sortedRows } = useTableSort(filtered, {
    title: (advice) => advice.title.ar,
    video: (advice) => advice.videoUrl,
    status: (advice) => (advice.status === "active" ? 0 : 1)
  });
  const showReorder = canReorder && filtered.length > 1 && !sort;

  if (!canReadErpModule(user, "advices")) {
    return (
      <ForbiddenPage title="نصائح كابيلا" crumbs={[{ label: "نصائح كابيلا" }]} message="لا تملكين صلاحية الوصول إلى النصائح." />
    );
  }

  const canToggle = canToggleErpModule(user, "advices");
  const canEdit = canUpdateErpModule(user, "advices");
  const canDelete = hasErpPermission(user, "advices.delete");

  return (
    <AdminShell
      title="نصائح كابيلا"
      crumbs={[{ label: "نصائح كابيلا" }]}
      description="نصائح بالفيديو تظهر للعملاء في المتجر."
      actions={
        <>
          {reorder.isDirty && canEdit ? (
            <Button variant="secondary" onClick={() => { void reorder.saveOrder(); }} disabled={reorder.saving}>
              <Check /> حفظ ترتيب النصائح
            </Button>
          ) : null}
          {canCreateErpModule(user, "advices") ? (
            <Button asChild variant="primary">
              <Link href="/advices/new"><Plus /> نصيحة جديدة</Link>
            </Button>
          ) : undefined}
        </>
      }
    >
      <AdminListHeader
        searchPlaceholder="ابحثي باسم النصيحة…"
        searchValue={search}
        onSearchChange={setSearch}
        countLabel={loaded ? `${formatNumber(filtered.length)} نصيحة` : "جارٍ التحميل…"}
        sort={tableSortSelect(ADVICE_SORT_COLUMNS, sort, setSort)}
        filters={[
          {
            key: "status",
            label: "الحالة",
            icon: CircleDot,
            value: statusFilter,
            onChange: (value) => setStatusFilter(value as "all" | "active" | "inactive"),
            options: ACTIVE_STATUS_FILTER_OPTIONS
          }
        ]}
      />

      <AdvicesTable
        loading={!loaded}
        advices={sortedRows}
        sort={sort}
        onSort={toggleSort}
        showReorder={showReorder}
        canToggle={canToggle}
        canEdit={canEdit}
        canDelete={canDelete}
        onMove={(id, direction) => reorder.moveItem(id, direction)}
        onToggle={setPendingToggle}
        onDelete={setPendingDelete}
        emptyTitle={advices.length === 0 ? "لا توجد نصائح بعد" : "لا توجد نصائح تطابق البحث"}
        emptyDescription={advices.length === 0 ? "ابدئي بإضافة أول نصيحة للعملاء." : "جرّبي كلمة أخرى أو غيّري فلتر الحالة."}
      />

      <AdminConfirmModal
        open={pendingToggle != null}
        title={pendingToggle?.status === "active" ? "تأكيد الإيقاف" : "تأكيد التفعيل"}
        onClose={() => setPendingToggle(null)}
        confirmLabel="تأكيد"
        onConfirm={async () => {
          if (!pendingToggle) return;
          await getStore().toggleAdviceStatus(pendingToggle.id);
          setPendingToggle(null);
        }}
      >
        <p>
          {pendingToggle?.status === "active"
            ? "سيتم إيقاف هذه النصيحة ولن تظهر في المتجر. هل تريدين المتابعة؟"
            : "سيتم تفعيل هذه النصيحة لتظهر في المتجر. هل تريدين المتابعة؟"}
        </p>
      </AdminConfirmModal>

      <AdminConfirmModal
        open={pendingDelete != null}
        title="تأكيد الحذف"
        onClose={() => setPendingDelete(null)}
        confirmLabel="حذف النصيحة"
        tone="danger"
        onConfirm={() => {
          if (!pendingDelete) return;
          void getStore().deleteAdvice(pendingDelete.id);
          setPendingDelete(null);
        }}
      >
        <p>سيتم حذف هذه النصيحة نهائيًا. هل تريدين المتابعة؟</p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
