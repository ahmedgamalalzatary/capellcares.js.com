"use client";

import { useEffect, useState } from "react";
import type { AnnouncementItemDto } from "@minikoshk/shared";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { ErpForbiddenState } from "@/components/admin/erp-forbidden-state";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { hasErpPermission } from "@/lib/erp-permissions";
import { showErrorToast } from "@/lib/errors";
import { getStore, useStore } from "@/lib/store";

function AnnouncementEditor({
  item,
  index,
  itemIds,
  editable,
  pending,
  run,
  requestDelete
}: {
  item: AnnouncementItemDto;
  index: number;
  itemIds: number[];
  editable: boolean;
  pending: boolean;
  run: (key: string, operation: () => Promise<void>) => void;
  requestDelete: (item: AnnouncementItemDto) => void;
}) {
  const [arText, setArText] = useState(item.text.ar);
  const [enText, setEnText] = useState(item.text.en);
  const move = (offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= itemIds.length) return;
    const reordered = [...itemIds];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    run(`move-${item.id}`, () => getStore().reorderAnnouncementItems(reordered));
  };

  return (
    <article className="card">
      <div className="card__body" style={{ display: "grid", gap: 12 }}>
        <label>
          <span className="label">النص العربي</span>
          <input
            className="input"
            aria-label={`النص العربي للإعلان ${item.text.en}`}
            value={arText}
            onChange={(event) => setArText(event.target.value)}
            disabled={!editable || pending}
          />
        </label>
        <label>
          <span className="label">النص الإنجليزي</span>
          <input
            className="input"
            aria-label={`النص الإنجليزي للإعلان ${item.text.en}`}
            value={enText}
            onChange={(event) => setEnText(event.target.value)}
            disabled={!editable || pending}
          />
        </label>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            aria-label={`حفظ ${item.text.en}`}
            disabled={!editable || pending || !arText.trim() || !enText.trim()}
            onClick={() => run(`save-${item.id}`, () => getStore().updateAnnouncementItem(item.id, {
              text: { ar: arText.trim(), en: enText.trim() }
            }))}
          >
            حفظ
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-label={`${item.isActive ? "تعطيل" : "تفعيل"} ${item.text.en}`}
            disabled={!editable || pending}
            onClick={() => run(`status-${item.id}`, () => getStore().updateAnnouncementItem(item.id, {
              isActive: !item.isActive
            }))}
          >
            {item.isActive ? "تعطيل" : "تفعيل"}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-label={`تحريك ${item.text.en} لأعلى`}
            disabled={!editable || pending || index === 0}
            onClick={() => move(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-label={`تحريك ${item.text.en} لأسفل`}
            disabled={!editable || pending || index === itemIds.length - 1}
            onClick={() => move(1)}
          >
            ↓
          </button>
          <button
            type="button"
            className="btn btn--danger btn--sm"
            aria-label={`حذف ${item.text.en}`}
            disabled={!editable || pending}
            onClick={() => requestDelete(item)}
          >
            حذف
          </button>
        </div>
      </div>
    </article>
  );
}

export default function AnnouncementBarPage() {
  const { user } = useAdminAuth();
  const announcementBar = useStore((store) => store.announcementBar);
  const announcementBarWarning = useStore((store) => store.announcementBarWarning);
  const canRead = hasErpPermission(user, "announcement_bar.read");
  const editable = hasErpPermission(user, "announcement_bar.update");
  const [newArText, setNewArText] = useState("");
  const [newEnText, setNewEnText] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AnnouncementItemDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canRead) return;
    void getStore().fetchAnnouncementBar().catch((loadError) => {
      setError(showErrorToast(loadError, "تعذر تحميل شريط الإعلانات. حاول مرة أخرى."));
    });
  }, [canRead]);

  const run = (key: string, operation: () => Promise<void>) => {
    setError(null);
    setPendingKey(key);
    void operation()
      .catch((operationError) => {
        setError(showErrorToast(operationError, "تعذر حفظ التغييرات. حاول مرة أخرى."));
      })
      .finally(() => setPendingKey(null));
  };

  if (!canRead) {
    return (
      <AdminShell title="شريط الإعلانات" crumbs={[{ label: "شريط الإعلانات" }]}>
        <ErpForbiddenState message="لا تملك صلاحية الوصول إلى شريط الإعلانات." />
      </AdminShell>
    );
  }

  const itemIds = announcementBar.items.map((item) => item.id);
  return (
    <AdminShell title="شريط الإعلانات" crumbs={[{ label: "شريط الإعلانات" }]}>
      <h2 style={{ margin: 0 }}>شريط الإعلانات</h2>
      <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
        <section className="card">
          <div className="card__body">
            <label className="row" style={{ justifyContent: "space-between" }}>
              <span>عرض شريط الإعلانات</span>
              <input
                type="checkbox"
                aria-label="عرض شريط الإعلانات"
                checked={announcementBar.enabled}
                disabled={!editable || pendingKey !== null}
                onChange={(event) => run("settings", () => getStore().setAnnouncementBarEnabled(event.target.checked))}
              />
            </label>
          </div>
        </section>

        {announcementBar.items.map((item, index) => (
          <AnnouncementEditor
            key={item.id}
            item={item}
            index={index}
            itemIds={itemIds}
            editable={editable}
            pending={pendingKey !== null}
            run={run}
            requestDelete={setPendingDelete}
          />
        ))}

        {editable ? (
          <section className="card">
            <div className="card__head"><h3 className="card__title">إضافة إعلان</h3></div>
            <div className="card__body" style={{ display: "grid", gap: 12 }}>
              <label>
                <span className="label">النص العربي</span>
                <input
                  className="input"
                  aria-label="النص العربي الجديد"
                  value={newArText}
                  onChange={(event) => setNewArText(event.target.value)}
                  maxLength={500}
                />
              </label>
              <label>
                <span className="label">النص الإنجليزي</span>
                <input
                  className="input"
                  aria-label="النص الإنجليزي الجديد"
                  value={newEnText}
                  onChange={(event) => setNewEnText(event.target.value)}
                  maxLength={500}
                />
              </label>
              <button
                type="button"
                className="btn btn--primary"
                disabled={pendingKey !== null || !newArText.trim() || !newEnText.trim()}
                onClick={() => run("create", async () => {
                  await getStore().createAnnouncementItem({ ar: newArText.trim(), en: newEnText.trim() });
                  setNewArText("");
                  setNewEnText("");
                })}
              >
                إضافة إعلان
              </button>
            </div>
          </section>
        ) : null}
      </div>
      {announcementBarWarning ? <p className="field-warning" role="status">{announcementBarWarning}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
      <AdminConfirmModal
        open={pendingDelete !== null}
        title="تأكيد حذف الإعلان"
        confirmLabel="حذف الإعلان"
        confirmClassName="btn btn--danger btn--sm"
        disableCancel={pendingKey !== null}
        disableConfirm={pendingKey !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          run(`delete-${pendingDelete.id}`, async () => {
            await getStore().deleteAnnouncementItem(pendingDelete.id);
            setPendingDelete(null);
          });
        }}
      >
        <p style={{ margin: 0 }}>
          سيتم حذف الإعلان «{pendingDelete?.text.ar} / {pendingDelete?.text.en}» نهائيًا. هل تريد المتابعة؟
        </p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
