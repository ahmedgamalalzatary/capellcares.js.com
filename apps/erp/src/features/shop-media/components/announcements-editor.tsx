"use client";

import { Plus, Trash2 } from "lucide-react";
import { FoldButton } from "@/components/admin/fold-button";
import { ReorderButtons } from "@/components/admin/reorder-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { moveItem as moveArrayItem } from "@/lib/array";
import type { EditableAnnouncement } from "@/features/shop-media/types";

type AnnouncementsEditorProps = {
  announcementItems: EditableAnnouncement[];
  barStatus: "active" | "inactive";
  announcementsDirty: boolean;
  savingAnnouncements: boolean;
  canEdit: boolean;
  collapsedItems: ReadonlySet<string>;
  toggleCollapsedItem: (key: string) => void;
  markAnnouncementsDirty: (updater: (current: EditableAnnouncement[]) => EditableAnnouncement[]) => void;
  setBarStatusDirty: (status: "active" | "inactive") => void;
  saveAnnouncements: () => Promise<void>;
  addAnnouncement: () => void;
};

export function AnnouncementsEditor({
  announcementItems, barStatus, announcementsDirty, savingAnnouncements, canEdit,
  collapsedItems, toggleCollapsedItem, markAnnouncementsDirty, setBarStatusDirty,
  saveAnnouncements, addAnnouncement
}: AnnouncementsEditorProps) {
  const isAnnouncementsCollapsed = collapsedItems.has("announcements");
  return (
    <Card>
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <FoldButton collapsed={isAnnouncementsCollapsed} onClick={() => toggleCollapsedItem("announcements")} label={isAnnouncementsCollapsed ? "توسيع القسم" : "طي القسم"} />
          <div className="min-w-0">
            <h2 className="text-md font-bold">شريط الإعلانات</h2>
            <p className="text-sm text-text-muted">يظهر أعلى المتجر ويتبدّل بين الرسائل النشطة.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="neutral" swatch={false}>{announcementItems.length} رسالة</Badge>
          {announcementsDirty ? <span className="text-xs font-medium text-warning">تغييرات غير محفوظة</span> : null}
          {canEdit ? (
            <>
              <label className="flex items-center gap-2 text-sm text-text-2">
                <Switch checked={barStatus === "active"} onCheckedChange={(checked) => setBarStatusDirty(checked ? "active" : "inactive")} aria-label="تفعيل شريط الإعلانات" />
                {barStatus === "active" ? "الشريط ظاهر" : "الشريط مخفي"}
              </label>
              <Button variant="primary" size="sm" disabled={savingAnnouncements || !announcementsDirty} onClick={() => { void saveAnnouncements(); }}>
                {savingAnnouncements ? "جارٍ الحفظ…" : "حفظ الإعلانات"}
              </Button>
            </>
          ) : null}
        </div>
      </header>

      {isAnnouncementsCollapsed ? null : (
        <CardBody className="grid gap-3">
          {announcementItems.length === 0 ? (
            <div className="rounded-well border border-dashed border-line-strong bg-sunken px-6 py-8 text-center text-sm text-text-muted">
              لا توجد رسائل إعلانية بعد.
            </div>
          ) : (
            <ol className="grid gap-3">
              {announcementItems.map((item, index) => {
                const itemKey = `announcement:${item.id}`;
                const isItemCollapsed = collapsedItems.has(itemKey);
                const summary = item.arText.trim() || item.enText.trim() || "بدون نص";
                return (
                  <li key={item.id} className="grid gap-3 rounded-well bg-sunken p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <FoldButton collapsed={isItemCollapsed} onClick={() => toggleCollapsedItem(itemKey)} label={isItemCollapsed ? "توسيع العنصر" : "طي العنصر"} />
                        <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-surface text-sm font-medium text-text-2 shadow-inset">{index + 1}</span>
                        {isItemCollapsed ? <span className="truncate text-sm text-text-muted">{summary}</span> : null}
                      </div>
                      {canEdit ? (
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 text-sm text-text-2">
                            <Switch
                              checked={item.status === "active"}
                              onCheckedChange={(checked) => markAnnouncementsDirty((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: checked ? "active" : "inactive" } : entry))}
                              aria-label="تفعيل الإعلان"
                            />
                            {item.status === "active" ? "نشط" : "غير نشط"}
                          </label>
                          <ReorderButtons index={index} count={announcementItems.length} className="gap-2" onMove={(i, delta) => markAnnouncementsDirty((current) => moveArrayItem(current, i, delta))} />
                          <Button variant="danger-ghost" size="icon-sm" aria-label="إزالة الإعلان" onClick={() => markAnnouncementsDirty((current) => current.filter((entry) => entry.id !== item.id))}>
                            <Trash2 />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    {isItemCollapsed ? null : (
                      <div className="grid gap-3 @lg:grid-cols-2">
                        <Field label="النص العربي" htmlFor={`announcement-ar-${item.id}`}>
                          <Input id={`announcement-ar-${item.id}`} value={item.arText} disabled={!canEdit} onChange={(event) => markAnnouncementsDirty((current) => current.map((entry) => entry.id === item.id ? { ...entry, arText: event.target.value } : entry))} />
                        </Field>
                        <Field label="النص بالإنجليزية" htmlFor={`announcement-en-${item.id}`}>
                          <Input id={`announcement-en-${item.id}`} dir="ltr" value={item.enText} disabled={!canEdit} onChange={(event) => markAnnouncementsDirty((current) => current.map((entry) => entry.id === item.id ? { ...entry, enText: event.target.value } : entry))} />
                        </Field>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {canEdit ? (
            <Button variant="secondary" size="sm" className="justify-self-start" onClick={addAnnouncement}>
              <Plus /> إضافة إعلان
            </Button>
          ) : null}
        </CardBody>
      )}
    </Card>
  );
}
