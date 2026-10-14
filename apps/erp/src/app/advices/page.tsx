"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, CircleDot, Plus } from "lucide-react";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ACTIVE_STATUS_FILTER_OPTIONS, AdminListHeader } from "@/components/admin/admin-list-header";
import { tableSortSelect } from "@/components/admin/admin-list-header";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Button } from "@/components/ui/button";
import { ADVICE_SORT_COLUMNS, AdvicesTable } from "@/features/advices/components/advices-table";
import type { Advice } from "@capella/shared";
import { canCreateErpModule, canReadErpModule, canToggleErpModule, canUpdateErpModule, hasErpPermission } from "@/lib/erp-permissions";
import { formatNumber } from "@/lib/format";
import { showErrorToast } from "@/lib/errors";
import { getStore, useStore } from "@/lib/store";
import { sortByIdOrder, useListReorder } from "@/hooks/use-list-reorder";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { SmartPagination } from "@/components/admin/smart-pagination";
import type { ListSchema } from "@/lib/pagination";
import { sortRows } from "@/lib/table-sort";

const ADVICES_LIST = {
  filters: { status: { default: "all", values: ["all", "active", "inactive"] } },
  sortKeys: ADVICE_SORT_COLUMNS.map((column) => column.key)
} satisfies ListSchema<"status", (typeof ADVICE_SORT_COLUMNS)[number]["key"]>;

const ADVICE_TOGGLE_ERROR = "تعذر تحديث حالة النصيحة. حاولي مرة أخرى.";

const adviceSortAccessors = {
  title: (advice: Advice) => advice.title.ar,
  video: (advice: Advice) => advice.videoUrl,
  status: (advice: Advice) => (advice.status === "active" ? 0 : 1)
};

export default function AdvicesPage() {
  const { user } = useAdminAuth();
  const advices = useStore((s) => s.advices);
  const loaded = useStore((s) => s.loaded);
  const list = usePaginatedList({ listId: "advices", schema: ADVICES_LIST });
  const search = list.state.q;
  const statusFilter = list.state.filters.status;
  const sort = list.state.sort;
  const [pendingToggle, setPendingToggle] = useState<Advice | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Advice | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
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

  const sortedRows = useMemo(() => sortRows(filtered, adviceSortAccessors, sort), [filtered, sort]);
  const showReorder = canReorder && filtered.length > 1 && !sort;

  if (!canReadErpModule(user, "advices")) {
    return (
      <ForbiddenPage title="نصائح كابيلا" crumbs={[{ label: "نصائح كابيلا" }]} message="لا تملكين صلاحية الوصول إلى النصائح." />
    );
  }

  const canToggle = canToggleErpModule(user, "advices");
  const canEdit = canUpdateErpModule(user, "advices");
  const canDelete = hasErpPermission(user, "advices.delete");

  const closeToggleModal = () => {
    if (isToggling) return;
    setPendingToggle(null);
    setToggleError(null);
  };

  const confirmToggle = async () => {
    if (!pendingToggle) return;
    try {
      setIsToggling(true);
      setToggleError(null);
      await getStore().toggleAdviceStatus(pendingToggle.id);
      setPendingToggle(null);
    } catch (error) {
      showErrorToast(error, ADVICE_TOGGLE_ERROR);
      setToggleError(ADVICE_TOGGLE_ERROR);
    } finally {
      setIsToggling(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await getStore().deleteAdvice(pendingDelete.id);
      setPendingDelete(null);
    } catch (error) {
      showErrorToast(error, "تعذر حذف النصيحة. حاولي مرة أخرى.");
    }
  };

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
        searchValue={list.searchInput}
        onSearchChange={list.setSearch}
        countLabel={loaded ? `${formatNumber(filtered.length)} نصيحة` : "جارٍ التحميل…"}
        sort={tableSortSelect(ADVICE_SORT_COLUMNS, sort, list.setSort)}
        filters={[
          {
            key: "status",
            label: "الحالة",
            icon: CircleDot,
            value: statusFilter,
            onChange: (value) => list.setFilter("status", value),
            options: ACTIVE_STATUS_FILTER_OPTIONS
          }
        ]}
      />

      <AdvicesTable
        loading={!loaded}
        advices={list.pageOf(sortedRows)}
        sort={sort}
        onSort={list.toggleSort}
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

      <SmartPagination {...list.paginationProps(sortedRows.length, !loaded)} />

      <AdminConfirmModal
        open={pendingToggle != null}
        title={pendingToggle?.status === "active" ? "تأكيد الإيقاف" : "تأكيد التفعيل"}
        onClose={closeToggleModal}
        confirmLabel={isToggling ? "جارٍ التحديث…" : "تأكيد"}
        disableCancel={isToggling}
        disableConfirm={isToggling}
        onConfirm={confirmToggle}
      >
        <p>
          {pendingToggle?.status === "active"
            ? "سيتم إيقاف هذه النصيحة ولن تظهر في المتجر. هل تريدين المتابعة؟"
            : "سيتم تفعيل هذه النصيحة لتظهر في المتجر. هل تريدين المتابعة؟"}
        </p>
        {toggleError ? <p role="alert" className="mt-3 text-sm font-medium text-danger">{toggleError}</p> : null}
      </AdminConfirmModal>

      <AdminConfirmModal
        open={pendingDelete != null}
        title="تأكيد الحذف"
        onClose={() => setPendingDelete(null)}
        confirmLabel="حذف النصيحة"
        tone="danger"
        onConfirm={confirmDelete}
      >
        <p>سيتم حذف هذه النصيحة نهائيًا. هل تريدين المتابعة؟</p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
