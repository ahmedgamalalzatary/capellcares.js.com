"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { AdminListToolbar } from "@/components/admin/admin-list-toolbar";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { canCreateErpModule, canReadErpModule, canToggleErpModule, canUpdateErpModule, hasErpPermission } from "@/lib/erp-permissions";
import { getStore, useStore } from "@/lib/store";
import { Icon } from "@/components/ui/icons";
import { RowMenu } from "@/components/ui/row-menu";
import type { Advice } from "@capella/shared";
import { sortByIdOrder, useListReorder } from "@/hooks/use-list-reorder";

export default function AdvicesPage() {
  const { user } = useAdminAuth();
  const advices = useStore((s) => s.advices);
  const [search, setSearch] = useState("");
  const [pendingToggle, setPendingToggle] = useState<Advice | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Advice | null>(null);
  const reorder = useListReorder({
    persistedIds: useMemo(() => advices.map((advice) => advice.id), [advices]),
    save: (ids) => getStore().reorderAdvices({ ids }),
    successMessage: "تم حفظ ترتيب النصائح.",
    errorMessage: "تعذر حفظ ترتيب النصائح. حاولي مرة أخرى."
  });
  const canReorder = !search.trim() && canUpdateErpModule(user, "advices");

  const filtered = useMemo(() => {
    const ordered = sortByIdOrder(advices, reorder.orderedIds);
    if (!search.trim()) return ordered;
    const term = search.trim().toLowerCase();
    return ordered.filter((a) =>
      a.title.ar.toLowerCase().includes(term) ||
      a.title.en.toLowerCase().includes(term)
    );
  }, [advices, reorder.orderedIds, search]);

  if (!canReadErpModule(user, "advices")) {
    return (
      <AdminShell title="نصائح كابيلا" crumbs={[{ label: "نصائح كابيلا" }]}>
        <ErpForbiddenState message="لا تملكين صلاحية الوصول إلى النصائح." />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="نصائح كابيلا"
      crumbs={[{ label: "نصائح كابيلا" }]}
      actions={
        <>
          {reorder.isDirty && canUpdateErpModule(user, "advices") && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                void reorder.saveOrder();
              }}
              disabled={reorder.saving}
            >
              <Icon.Check /> حفظ ترتيب النصائح
            </button>
          )}
          {canCreateErpModule(user, "advices") ? (
            <Link href="/advices/new" className="btn btn--primary btn--sm">
              <Icon.Plus /> نصيحة جديدة
            </Link>
          ) : undefined}
        </>
      }
    >
      <AdminListToolbar
        searchPlaceholder="ابحثي عن نصيحة…"
        searchValue={search}
        onSearchChange={setSearch}
        countLabel={`${filtered.length} نصيحة`}
      />

      <div className="card">
        <div className="table-outer">
          <table className="table">
            <thead>
              <tr>
                <th>العنوان</th>
                <th>الفيديو</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((advice, index) => (
                <tr key={advice.id}>
                  <td>
                    <Link href={`/advices/${advice.id}/edit`} className="table-title">{advice.title.ar}</Link>
                    <div className="table-subtitle">{advice.title.en}</div>
                  </td>
                  <td className="muted" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {advice.videoUrl}
                  </td>
                  <td><AdminStatusBadge active={advice.status === "active"} activeLabel="نشط" inactiveLabel="غير نشط" /></td>
                  <td>
                    <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                      {canReorder && filtered.length > 1 && (
                        <>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => reorder.moveItem(advice.id, -1)}
                            aria-label="تحريك لأعلى"
                            disabled={index === 0}
                          >
                            <Icon.Chevron size={14} className="rotate-180" />
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => reorder.moveItem(advice.id, 1)}
                            aria-label="تحريك لأسفل"
                            disabled={index === filtered.length - 1}
                          >
                            <Icon.Chevron size={14} />
                          </button>
                        </>
                      )}
                      {(canToggleErpModule(user, "advices") || canUpdateErpModule(user, "advices") || hasErpPermission(user, "advices.delete")) && (
                        <RowMenu>
                          {canToggleErpModule(user, "advices") && (
                            <button
                              type="button"
                              className="row-menu__item"
                              onClick={() => setPendingToggle(advice)}
                              title={advice.status === "active" ? "إيقاف" : "تفعيل"}
                            >
                              {advice.status === "active" ? <><Icon.X /> إيقاف</> : <><Icon.Check /> تفعيل</>}
                            </button>
                          )}
                          {canUpdateErpModule(user, "advices") && (
                            <Link href={`/advices/${advice.id}/edit`} className="row-menu__item">
                              <Icon.Edit /> تعديل
                            </Link>
                          )}
                          {hasErpPermission(user, "advices.delete") && (
                            <button type="button" className="row-menu__item row-menu__item--danger" onClick={() => setPendingDelete(advice)}>
                              <Icon.Trash /> حذف
                            </button>
                          )}
                        </RowMenu>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>لا توجد نصائح بعد.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
        <p style={{ margin: 0 }}>
          {pendingToggle?.status === "active"
            ? "سيتم إيقاف هذه النصيحة ولن تظهر في المتجر. هل تريدين المتابعة؟"
            : "سيتم تفعيل هذه النصيحة لتظهر في المتجر. هل تريدين المتابعة؟"}
        </p>
      </AdminConfirmModal>

      <AdminConfirmModal
        open={pendingDelete != null}
        title="تأكيد الحذف"
        onClose={() => setPendingDelete(null)}
        confirmLabel="حذف"
        confirmClassName="btn btn--danger btn--sm"
        onConfirm={() => {
          if (!pendingDelete) return;
          void getStore().deleteAdvice(pendingDelete.id);
          setPendingDelete(null);
        }}
      >
        <p style={{ margin: 0 }}>سيتم حذف هذه النصيحة نهائيًا. هل تريدين المتابعة؟</p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
