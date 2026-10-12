"use client";

import { Plus, Trash2 } from "lucide-react";
import { FoldButton } from "@/components/admin/fold-button";
import { ReorderButtons } from "@/components/admin/reorder-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ShopMediaTargetType } from "@capella/shared";
import { StatusBadge } from "@/components/admin/status-badge";
import { SingleImageField } from "@/components/forms/single-image-field";
import { Thumb } from "@/components/ui/thumb";
import { resolveMediaSrc } from "@/lib/media";
import type { CategoryTreeOption } from "@/lib/category-tree";
import { isDetailTargetType } from "@/features/shop-media/lib/editable-section";
import type { EditableItem, EditableSection } from "@/features/shop-media/types";

const listingTargetOptions: Array<{ value: ShopMediaTargetType; label: string }> = [
  { value: "shop", label: "صفحة المتجر" },
  { value: "new", label: "وصل حديثًا" },
  { value: "bestsellers", label: "الأكثر مبيعًا" },
  { value: "products", label: "كل المنتجات" },
  { value: "offers", label: "كل العروض" },
  { value: "collections", label: "كل المجموعات" }
];

const detailTargetOptions: Array<{ value: ShopMediaTargetType; label: string }> = [
  { value: "product", label: "منتج" },
  { value: "offer", label: "عرض" },
  { value: "collection", label: "مجموعة" },
  { value: "category", label: "قسم" }
];

const slotPositionLabel: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "يظهر أعلى صفحة المتجر",
  2: "يظهر فوق قسم المجموعات",
  3: "يظهر فوق المنتجات المميزة",
  4: "يظهر أسفل قسم الأكثر مبيعًا",
  5: "يظهر أسفل قسم وصل حديثًا"
};

type SectionEditorProps = {
  section: EditableSection;
  isDirty: boolean;
  isSaving: boolean;
  isCollapsed: boolean;
  canEdit: boolean;
  collapsedItems: ReadonlySet<string>;
  targetOptionsByType: Record<"product" | "offer" | "collection" | "category", CategoryTreeOption[]>;
  toggleCollapsed: (slot: EditableSection["slot"]) => void;
  toggleCollapsedItem: (key: string) => void;
  setSection: (slot: EditableSection["slot"], updater: (current: EditableSection) => EditableSection) => void;
  saveSection: (section: EditableSection) => Promise<void>;
  addItem: (slot: EditableSection["slot"]) => void;
  moveItem: (slot: EditableSection["slot"], id: string, direction: -1 | 1) => void;
  hasMissingTarget: (item: EditableItem) => boolean;
};

export function SectionEditor({
  section, isDirty, isSaving, isCollapsed, canEdit, collapsedItems, targetOptionsByType,
  toggleCollapsed, toggleCollapsedItem, setSection, saveSection, addItem, moveItem, hasMissingTarget
}: SectionEditorProps) {
  const isActive = section.status === "active";
  const previewItems = section.items
    .map((item) => resolveMediaSrc(item.arImagePath || item.arMobileImagePath || item.enImagePath || item.enMobileImagePath))
    .filter((src): src is string => Boolean(src));

  return (
    <Card>
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <FoldButton collapsed={isCollapsed} onClick={() => toggleCollapsed(section.slot)} label={isCollapsed ? "توسيع القسم" : "طي القسم"} />
          <div className="min-w-0">
            <h2 className="text-md font-bold">القسم {section.slot}</h2>
            <p className="text-sm text-text-muted">{slotPositionLabel[section.slot]}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="neutral" swatch={false}>{section.items.length} صورة</Badge>
          {canEdit ? (
            <>
              <label className="flex items-center gap-2 text-sm text-text-2">
                <Switch
                  checked={isActive}
                  onCheckedChange={() => setSection(section.slot, (current) => ({ ...current, status: current.status === "active" ? "inactive" : "active" }))}
                  aria-label="تفعيل القسم"
                />
                {isActive ? "نشط" : "غير نشط"}
              </label>
              {isDirty ? <span className="text-xs font-medium text-warning">تغييرات غير محفوظة</span> : null}
              <Button variant="primary" size="sm" disabled={!isDirty || isSaving} onClick={() => { void saveSection(section); }}>
                {isSaving ? "جارٍ الحفظ…" : "حفظ القسم"}
              </Button>
            </>
          ) : (
            <StatusBadge active={isActive} />
          )}
        </div>
      </header>

      {previewItems.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-5 pb-3 sm:px-6" aria-hidden="true">
          {previewItems.map((src, index) => (
            <Thumb key={index} src={src} size="md" className="rounded-thumb" />
          ))}
        </div>
      ) : null}

      {isCollapsed ? null : (
        <CardBody className="grid gap-3">
          {section.items.length === 0 ? (
            <div className="grid justify-items-center gap-3 rounded-well border border-dashed border-line-strong bg-sunken px-6 py-8 text-center">
              <p className="text-sm text-text-muted">لا توجد صور في هذا القسم بعد.</p>
              {canEdit ? (
                <Button variant="secondary" size="sm" onClick={() => addItem(section.slot)}>
                  <Plus /> أضيفي أول صورة
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <ol className="grid gap-3">
                {section.items.map((item, index) => {
                  const detailOptions = isDetailTargetType(item.targetType) ? targetOptionsByType[item.targetType] : [];
                  const isDetail = isDetailTargetType(item.targetType);
                  const itemKey = `${section.slot}:${item.id}`;
                  const isItemCollapsed = collapsedItems.has(itemKey);
                  const typeLabel = [...listingTargetOptions, ...detailTargetOptions].find((option) => option.value === item.targetType)?.label ?? item.targetType;
                  const targetMissing = hasMissingTarget(item);
                  const targetSummary = isDetail
                    ? (detailOptions.find((option) => option.id === item.targetId)?.label ?? (targetMissing ? "العنصر محذوف — الصفحة الرئيسية" : "بدون عنصر"))
                    : typeLabel;
                  const thumbSrc = resolveMediaSrc(item.arImagePath || item.arMobileImagePath || item.enImagePath || item.enMobileImagePath);

                  return (
                    <li key={item.id} className="grid gap-3 rounded-well bg-sunken p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <FoldButton collapsed={isItemCollapsed} onClick={() => toggleCollapsedItem(itemKey)} label={isItemCollapsed ? "توسيع العنصر" : "طي العنصر"} />
                          <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-surface text-sm font-medium text-text-2 shadow-inset">{index + 1}</span>
                          {thumbSrc ? <Thumb src={thumbSrc} size="sm" /> : null}
                          {isItemCollapsed ? <span className="truncate text-sm text-text-muted">{typeLabel} · {targetSummary}</span> : null}
                        </div>
                        {canEdit ? (
                          <div className="flex items-center gap-1">
                            <ReorderButtons index={index} count={section.items.length} className="gap-1" onMove={(_i, delta) => moveItem(section.slot, item.id, delta)} />
                            <Button
                              variant="danger-ghost"
                              size="icon-sm"
                              aria-label="إزالة الصورة"
                              onClick={() => setSection(section.slot, (current) => ({ ...current, items: current.items.filter((entry) => entry.id !== item.id) }))}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      {isItemCollapsed ? null : (
                        <div className="grid gap-4">
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <SingleImageField label="سطح المكتب — العربية" value={item.arImagePath || null} uploadContext="shop_media.update" disabled={!canEdit} onChange={(value) => setSection(section.slot, (current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, arImagePath: value ?? "" } : entry) }))} />
                            <SingleImageField label="الموبايل — العربية" value={item.arMobileImagePath || null} uploadContext="shop_media.update" disabled={!canEdit} onChange={(value) => setSection(section.slot, (current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, arMobileImagePath: value ?? "" } : entry) }))} />
                            <SingleImageField label="سطح المكتب — الإنجليزية" value={item.enImagePath || null} uploadContext="shop_media.update" disabled={!canEdit} onChange={(value) => setSection(section.slot, (current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, enImagePath: value ?? "" } : entry) }))} />
                            <SingleImageField label="الموبايل — الإنجليزية" value={item.enMobileImagePath || null} uploadContext="shop_media.update" disabled={!canEdit} onChange={(value) => setSection(section.slot, (current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, enMobileImagePath: value ?? "" } : entry) }))} />
                          </div>

                          <div className="grid gap-3 @lg:grid-cols-2">
                            <Field label="نوع الوجهة" htmlFor={`target-type-${section.slot}-${item.id}`}>
                              <Select
                                id={`target-type-${section.slot}-${item.id}`}
                                value={item.targetType}
                                disabled={!canEdit}
                                onChange={(event) => {
                                  const nextType = event.target.value as ShopMediaTargetType;
                                  setSection(section.slot, (current) => ({
                                    ...current,
                                    items: current.items.map((entry) => entry.id === item.id ? {
                                      ...entry,
                                      targetType: nextType,
                                      targetId: isDetailTargetType(nextType) ? entry.targetId : null
                                    } : entry)
                                  }));
                                }}
                              >
                                {listingTargetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                {detailTargetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </Select>
                            </Field>

                            {isDetail ? (
                              <Field label="العنصر" htmlFor={`target-id-${section.slot}-${item.id}`}>
                                <Select
                                  id={`target-id-${section.slot}-${item.id}`}
                                  value={item.targetId ?? ""}
                                  disabled={!canEdit}
                                  onChange={(event) => setSection(section.slot, (current) => ({
                                    ...current,
                                    items: current.items.map((entry) => entry.id === item.id ? { ...entry, targetId: event.target.value ? Number(event.target.value) : null } : entry)
                                  }))}
                                >
                                  <option value="">اختاري عنصرًا</option>
                                  {detailOptions.map((option) => (
                                    <option key={option.id} value={option.id}>{`${"— ".repeat(option.depth)}${option.label}`}</option>
                                  ))}
                                </Select>
                              </Field>
                            ) : (
                              <Field label="الرابط">
                                <div className="flex h-10 items-center rounded-control bg-surface px-3 text-sm text-text-muted shadow-[inset_0_0_0_1px_var(--line)] pointer-coarse:h-11">
                                  صفحة قائمة — بدون عنصر محدد
                                </div>
                              </Field>
                            )}
                          </div>
                          {targetMissing ? (
                            <p className="text-sm text-warning">العنصر المرتبط محذوف — تفتح هذه الصورة الصفحة الرئيسية حتى تختاري عنصرًا جديدًا.</p>
                          ) : null}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>

              {canEdit ? (
                <Button variant="secondary" size="sm" className="justify-self-start" onClick={() => addItem(section.slot)}>
                  <Plus /> إضافة صورة
                </Button>
              ) : null}
            </>
          )}
        </CardBody>
      )}
    </Card>
  );
}
