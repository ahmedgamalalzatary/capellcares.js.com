"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, CircleDot, Lightbulb, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ACTIVE_STATUS_FILTER_OPTIONS, AdminListHeader } from "@/components/admin/admin-list-header";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RowMenu, RowMenuItem, RowMenuLink, RowMenuSeparator } from "@/components/ui/row-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTH, Table, TableState, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { Advice } from "@capella/shared";
import { canCreateErpModule, canReadErpModule, canToggleErpModule, canUpdateErpModule, hasErpPermission } from "@/lib/erp-permissions";
import { formatNumber } from "@/lib/format";
import { getStore, useStore } from "@/lib/store";
import { sortByIdOrder, useListReorder } from "@/hooks/use-list-reorder";
import { useTableSort } from "@/hooks/use-table-sort";

type AdviceSortKey = "title" | "video" | "status";

const ADVICE_SORT_COLUMNS: Array<{ key: AdviceSortKey; label: string }> = [
  { key: "title", label: "العنوان" },
  { key: "video", label: "الفيديو" },
  { key: "status", label: "الحالة" }
];

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
      <AdminShell title="نصائح كابيلا" crumbs={[{ label: "نصائح كابيلا" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى النصائح." />
      </AdminShell>
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
        sort={{
          value: sort ? `${sort.key}:${sort.direction}` : "",
          onChange: (value) => {
            const [key, direction] = value.split(":");
            setSort(key ? { key: key as AdviceSortKey, direction: direction as "asc" | "desc" } : null);
          },
          options: [
            { value: "", label: "ترتيب المتجر" },
            ...ADVICE_SORT_COLUMNS.flatMap((column) => [
              { value: `${column.key}:asc`, label: `${column.label} — تصاعدي` },
              { value: `${column.key}:desc`, label: `${column.label} — تنازلي` }
            ])
          ]
        }}
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

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              {ADVICE_SORT_COLUMNS.map((column) => (
                <SortableTH key={column.key} direction={sort?.key === column.key ? sort.direction : null} onSort={() => toggleSort(column.key)}>
                  {column.label}
                </SortableTH>
              ))}
              <TH className="w-px"><span className="sr-only">إجراءات</span></TH>
            </tr>
          </THead>
          <TBody aria-busy={!loaded}>
            {!loaded ? Array.from({ length: 5 }, (_, index) => (
              <TR key={index} aria-hidden>
                <TD data-cell="lead"><div className="grid gap-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-28" /></div></TD>
                <TD><Skeleton className="h-3.5 w-48" /></TD>
                <TD><Skeleton className="h-6 w-14 rounded-full" /></TD>
                <TD data-cell="actions" />
              </TR>
            )) : null}
            {loaded && sortedRows.map((advice, index) => {
              const active = advice.status === "active";
              return (
                <TR key={advice.id}>
                  <TD data-cell="lead">
                    <div className="min-w-0">
                      <Link href={`/advices/${advice.id}/edit`} className="truncate font-medium text-text-strong decoration-line-strong underline-offset-4 hover:underline">
                        {advice.title.ar}
                      </Link>
                      {advice.title.en ? <p dir="ltr" className="mt-0.5 truncate text-end text-sm text-text-muted">{advice.title.en}</p> : null}
                    </div>
                  </TD>
                  <TD data-label="الفيديو" className="max-w-md">
                    <bdi className="block truncate text-sm text-text-2">{advice.videoUrl}</bdi>
                  </TD>
                  <TD data-label="الحالة"><Badge tone={active ? "success" : "neutral"}>{active ? "نشط" : "غير نشط"}</Badge></TD>
                  <TD data-cell="actions">
                    <div className="flex items-center justify-end gap-0.5">
                      {showReorder ? (
                        <>
                          <Button variant="ghost" size="icon-sm" aria-label="تحريك لأعلى" disabled={index === 0} onClick={() => reorder.moveItem(advice.id, -1)}>
                            <ArrowUp />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label="تحريك لأسفل" disabled={index === sortedRows.length - 1} onClick={() => reorder.moveItem(advice.id, 1)}>
                            <ArrowDown />
                          </Button>
                        </>
                      ) : null}
                      {canToggle || canEdit || canDelete ? (
                        <RowMenu label={`إجراءات ${advice.title.ar}`}>
                          {canToggle ? (
                            <RowMenuItem onClick={() => setPendingToggle(advice)}>
                              {active ? <><PowerOff /> إيقاف</> : <><Power /> تفعيل</>}
                            </RowMenuItem>
                          ) : null}
                          {canEdit ? (
                            <RowMenuLink href={`/advices/${advice.id}/edit`}><Pencil /> تعديل</RowMenuLink>
                          ) : null}
                          {canDelete ? (
                            <>
                              <RowMenuSeparator />
                              <RowMenuItem danger onClick={() => setPendingDelete(advice)}><Trash2 /> حذف</RowMenuItem>
                            </>
                          ) : null}
                        </RowMenu>
                      ) : null}
                    </div>
                  </TD>
                </TR>
              );
            })}
            {loaded && sortedRows.length === 0 ? (
              <TableState colSpan={4}>
                <EmptyState
                  icon={<Lightbulb />}
                  title={advices.length === 0 ? "لا توجد نصائح بعد" : "لا توجد نصائح تطابق البحث"}
                  description={advices.length === 0 ? "ابدئي بإضافة أول نصيحة للعملاء." : "جرّبي كلمة أخرى أو غيّري فلتر الحالة."}
                />
              </TableState>
            ) : null}
          </TBody>
        </Table>
      </Card>

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
