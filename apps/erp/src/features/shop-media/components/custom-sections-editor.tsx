"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Images, LayoutList, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Category, ShopCustomBlock } from "@capella/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { moveItem as moveArrayItem } from "@/lib/array";
import { buildCategoryTreeOptions, type CategoryTreeOption } from "@/lib/category-tree";
import { showErrorToast } from "@/lib/errors";
import { getStore } from "@/lib/store";
import { SectionEditor } from "@/features/shop-media/components/section-editor";
import {
  findSectionError,
  newEditableItem,
  toEditableSection,
  toSectionItemsPayload
} from "@/features/shop-media/lib/editable-section";
import type { EditableCustomBlock, EditableItem, EditableSection } from "@/features/shop-media/types";

const MISSING_CATEGORY_MESSAGE = "اختاري قسمًا لكل قسم منتجات قبل الحفظ.";
const TRASHED_CATEGORY_MESSAGE = "أحد الأقسام المختارة محذوف. اختاري قسمًا آخر أو أزيلي القسم قبل الحفظ.";

function toEditableBlocks(blocks: ShopCustomBlock[]): EditableCustomBlock[] {
  return blocks.map((block) => (
    block.type === "category"
      ? { key: `block-${block.id}`, type: "category", categoryId: block.categoryId }
      : {
        key: `block-${block.id}`,
        type: "media",
        mediaSectionId: block.mediaSection.id,
        section: toEditableSection(block.mediaSection, `custom-${block.mediaSection.id}`)
      }
  ));
}

function BlockActions({ index, count, onMove, onRemove }: { index: number; count: number; onMove: (delta: -1 | 1) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" aria-label="تحريك القسم لأعلى" title="تحريك القسم لأعلى" disabled={index <= 0} onClick={() => onMove(-1)}>
        <ArrowUp />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="تحريك القسم لأسفل" title="تحريك القسم لأسفل" disabled={index >= count - 1} onClick={() => onMove(1)}>
        <ArrowDown />
      </Button>
      <Button variant="danger-ghost" size="icon-sm" aria-label="إزالة القسم" title="إزالة القسم" onClick={onRemove}>
        <Trash2 />
      </Button>
    </div>
  );
}

type CustomSectionsEditorProps = {
  storedBlocks: ShopCustomBlock[];
  categories: Category[];
  canEdit: boolean;
  targetOptionsByType: Record<"product" | "offer" | "collection" | "category", CategoryTreeOption[]>;
  hasMissingTarget: (item: EditableItem) => boolean;
  collapsedSections: ReadonlySet<string>;
  toggleCollapsedSection: (key: string) => void;
  collapsedItems: ReadonlySet<string>;
  toggleCollapsedItem: (key: string) => void;
};

/** The shop page's custom sections: an ordered list of category product rows and picture sections, shown between bestsellers and new arrivals. The whole list is saved at once. */
export function CustomSectionsEditor({
  storedBlocks, categories, canEdit, targetOptionsByType, hasMissingTarget,
  collapsedSections, toggleCollapsedSection, collapsedItems, toggleCollapsedItem
}: CustomSectionsEditorProps) {
  const [blocks, setBlocks] = useState<EditableCustomBlock[]>(() => toEditableBlocks(storedBlocks));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store refreshes replace the list only while nothing is being edited, so unsaved changes are never lost; after a save, the fresh list (with new ids) comes in.
  useEffect(() => {
    if (!dirty) {
      setBlocks(toEditableBlocks(storedBlocks));
    }
  }, [storedBlocks, dirty]);

  const categoryOptions = useMemo(() => buildCategoryTreeOptions(categories), [categories]);
  const liveCategoryIds = useMemo(() => new Set(categoryOptions.map((option) => option.id)), [categoryOptions]);
  const isTrashedCategory = (block: EditableCustomBlock) => block.type === "category" && block.categoryId != null && !liveCategoryIds.has(block.categoryId);

  const update = (updater: (current: EditableCustomBlock[]) => EditableCustomBlock[]) => {
    setDirty(true);
    setBlocks(updater);
  };

  const setSection = (key: string, updater: (current: EditableSection) => EditableSection) => update((current) => current.map((block) => (
    block.type === "media" && block.section.key === key ? { ...block, section: updater(block.section) } : block
  )));

  const addCategoryBlock = () => update((current) => [...current, { key: `new-${crypto.randomUUID()}`, type: "category", categoryId: null }]);

  const addMediaBlock = () => update((current) => {
    const key = `new-${crypto.randomUUID()}`;
    return [...current, { key, type: "media", mediaSectionId: null, section: { key, status: "active", items: [] } }];
  });

  const moveBlock = (index: number, delta: -1 | 1) => update((current) => moveArrayItem(current, index, delta));
  const removeBlock = (key: string) => update((current) => current.filter((block) => block.key !== key));

  const fail = (message: string) => {
    const failure = new Error(message);
    setError(message);
    showErrorToast(failure, message);
  };

  const save = async () => {
    if (blocks.some((block) => block.type === "category" && block.categoryId == null)) {
      fail(MISSING_CATEGORY_MESSAGE);
      return;
    }
    if (blocks.some(isTrashedCategory)) {
      fail(TRASHED_CATEGORY_MESSAGE);
      return;
    }
    for (const block of blocks) {
      const sectionError = block.type === "media" ? findSectionError(block.section, hasMissingTarget) : null;
      if (sectionError) {
        fail(sectionError);
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);
      await getStore().replaceShopCustomSections(blocks.map((block) => (
        block.type === "category"
          ? { type: "category" as const, categoryId: block.categoryId! }
          : {
            type: "media" as const,
            mediaSectionId: block.mediaSectionId,
            status: block.section.status,
            items: toSectionItemsPayload(block.section.items)
          }
      )));
      setDirty(false);
      toast.success("تم حفظ الأقسام المخصصة بنجاح.");
    } catch {
      fail("تعذر حفظ الأقسام المخصصة. حاولي مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4">
      <Card>
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-md font-bold">الأقسام المخصصة</h2>
            <p className="text-sm text-text-muted">تظهر في صفحة المتجر بين «الأكثر مبيعًا» و«وصل حديثًا» بهذا الترتيب. قسم المنتجات يعرض أحدث ١٢ منتجًا من القسم وكل ما تحته.</p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={addCategoryBlock}>
                <LayoutList /> إضافة قسم منتجات
              </Button>
              <Button variant="secondary" size="sm" onClick={addMediaBlock}>
                <Images /> إضافة قسم صور
              </Button>
              {dirty ? <span className="text-xs font-medium text-warning">تغييرات غير محفوظة</span> : null}
              <Button variant="primary" size="sm" disabled={!dirty || saving} onClick={() => { void save(); }}>
                {saving ? "جارٍ الحفظ…" : "حفظ الأقسام"}
              </Button>
            </div>
          ) : null}
        </header>
        {blocks.length === 0 ? (
          <CardBody>
            <p className="rounded-well border border-dashed border-line-strong bg-sunken px-6 py-8 text-center text-sm text-text-muted">
              لا توجد أقسام مخصصة بعد.
            </p>
          </CardBody>
        ) : null}
      </Card>

      {blocks.length > 0 ? (
        <ol className="grid gap-4">
          {blocks.map((block, index) => {
            const actions = canEdit ? (
              <BlockActions index={index} count={blocks.length} onMove={(delta) => moveBlock(index, delta)} onRemove={() => removeBlock(block.key)} />
            ) : null;

            if (block.type === "media") {
              return (
                <li key={block.key} data-custom-section>
                  <SectionEditor
                    section={block.section}
                    title={`${index + 1}. قسم صور`}
                    description="صور تظهر بين الأقسام المخصصة بنفس شكل صور المتجر."
                    headerActions={actions}
                    isCollapsed={collapsedSections.has(block.section.key)}
                    canEdit={canEdit}
                    collapsedItems={collapsedItems}
                    targetOptionsByType={targetOptionsByType}
                    toggleCollapsed={toggleCollapsedSection}
                    toggleCollapsedItem={toggleCollapsedItem}
                    setSection={setSection}
                    addItem={(key) => setSection(key, (current) => ({ ...current, items: [...current.items, newEditableItem()] }))}
                    moveItem={(key, id, direction) => setSection(key, (current) => {
                      const itemIndex = current.items.findIndex((entry) => entry.id === id);
                      if (itemIndex === -1) return current;
                      const items = moveArrayItem(current.items, itemIndex, direction);
                      return items === current.items ? current : { ...current, items };
                    })}
                    hasMissingTarget={hasMissingTarget}
                  />
                </li>
              );
            }

            // Each category may lead only one section, so categories already used elsewhere are left out of this picker.
            const usedElsewhere = new Set(blocks.flatMap((other) => (
              other.key !== block.key && other.type === "category" && other.categoryId != null ? [other.categoryId] : []
            )));
            const options = categoryOptions.filter((option) => !usedElsewhere.has(option.id));
            const selectId = `custom-category-${block.key}`;

            return (
              <li key={block.key} data-custom-section>
                <Card>
                  <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
                    <div className="min-w-0">
                      <h2 className="text-md font-bold">{`${index + 1}. قسم منتجات`}</h2>
                      <p className="text-sm text-text-muted">صف من أحدث منتجات القسم مع رابط «عرض الكل».</p>
                    </div>
                    {actions}
                  </header>
                  <CardBody>
                    <Field label="القسم" htmlFor={selectId}>
                      <Select
                        id={selectId}
                        value={block.categoryId ?? ""}
                        disabled={!canEdit}
                        onChange={(event) => {
                          const categoryId = event.target.value ? Number(event.target.value) : null;
                          update((current) => current.map((entry) => (entry.key === block.key && entry.type === "category" ? { ...entry, categoryId } : entry)));
                        }}
                      >
                        <option value="">اختاري قسمًا</option>
                        {options.map((option) => (
                          <option key={option.id} value={option.id}>{`${"— ".repeat(option.depth)}${option.label}`}</option>
                        ))}
                      </Select>
                    </Field>
                    {isTrashedCategory(block) ? (
                      <p className="mt-2 text-sm text-warning">القسم المختار محذوف، لذلك لا يظهر هذا القسم في المتجر. اختاري قسمًا آخر أو أزيلي القسم.</p>
                    ) : null}
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ol>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
