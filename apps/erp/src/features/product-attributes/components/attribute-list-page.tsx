"use client";

import { useEffect, useMemo, useState } from "react";
import { Baby, Check, Pencil, Plus, Sparkles, Tag, Trash2, Truck, type LucideIcon } from "lucide-react";
import type { ProductAttribute, Supplier } from "@capella/shared";
import { AdminConfirmModal } from "@/components/admin/admin-confirm-modal";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { TableEmptyRow, TableSkeletonRows } from "@/components/admin/list-table";
import { ForbiddenPage } from "@/components/admin/permission-gate";
import { ReorderButtons } from "@/components/admin/reorder-buttons";
import { SmartPagination } from "@/components/admin/smart-pagination";
import { BilingualNameFields } from "@/components/forms/editor-form-parts";
import { SingleImageField } from "@/components/forms/single-image-field";
import { useAdminAuth } from "@/components/providers/admin-auth";
import { AdminShell } from "@/components/shell/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RowMenu, RowMenuItem, RowMenuSeparator } from "@/components/ui/row-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTH, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Thumb } from "@/components/ui/thumb";
import { sortByIdOrder, useListReorder } from "@/hooks/use-list-reorder";
import { usePaginatedList } from "@/hooks/use-paginated-list";
import { canReadErpModule, canUpdateErpModule } from "@/lib/erp-permissions";
import { showErrorToast } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { resolveMediaSrc } from "@/lib/media";
import type { ListSchema } from "@/lib/pagination";
import { getStore, useStore } from "@/lib/store";
import type { ProductAttributeKind } from "@/lib/store/types";
import { sortRows } from "@/lib/table-sort";

type Config = {
  title: string;
  description: string;
  noun: string;
  newLabel: string;
  imageLabel?: string;
  emptyTitle: string;
  emptyDescription: string;
  icon: LucideIcon;
};

const CONFIG: Record<ProductAttributeKind, Config> = {
  brands: {
    title: "الماركات",
    description: "الماركات التي تختارينها للمنتج، وتظهر في قسم «تسوق حسب الماركة» بالمتجر.",
    noun: "ماركة",
    newLabel: "ماركة جديدة",
    imageLabel: "صورة الماركة",
    emptyTitle: "لا توجد ماركات بعد",
    emptyDescription: "ابدئي بإضافة أول ماركة.",
    icon: Tag
  },
  characters: {
    title: "الشخصيات",
    description: "الشخصيات مثل سبايدرمان وباتمان، وتظهر في قسم «تسوق حسب الشخصية» بالمتجر.",
    noun: "شخصية",
    newLabel: "شخصية جديدة",
    imageLabel: "صورة الشخصية",
    emptyTitle: "لا توجد شخصيات بعد",
    emptyDescription: "ابدئي بإضافة أول شخصية.",
    icon: Sparkles
  },
  ageGroups: {
    title: "الفئات العمرية",
    description: "الأعمار التي تختارينها للمنتج، ويستخدمها العملاء لتصفية المنتجات.",
    noun: "فئة عمرية",
    newLabel: "فئة عمرية جديدة",
    emptyTitle: "لا توجد فئات عمرية بعد",
    emptyDescription: "ابدئي بإضافة أول فئة، مثل 0-2 سنة.",
    icon: Baby
  },
  suppliers: {
    title: "الموردون",
    description: "للاستخدام الداخلي فقط، ولا يظهرون للعملاء.",
    noun: "مورد",
    newLabel: "مورد جديد",
    emptyTitle: "لا يوجد موردون بعد",
    emptyDescription: "ابدئي بإضافة أول مورد.",
    icon: Truck
  }
};

const LIST_SCHEMA = { filters: {}, sortKeys: ["name"] } satisfies ListSchema<never, "name">;

type Row = { id: number; primary: string; secondary?: string; imagePath?: string | null };

function toRow(item: ProductAttribute | Supplier): Row {
  if ("name" in item && typeof item.name === "string") return { id: item.id, primary: item.name };
  const attribute = item as ProductAttribute;
  return { id: attribute.id, primary: attribute.name.ar, secondary: attribute.name.en, imagePath: attribute.imagePath };
}

const nameAccessors = { name: (row: Row) => row.primary };

function AttributeEditor({
  kind,
  editing,
  onClose
}: {
  kind: ProductAttributeKind;
  editing: Row | "new" | null;
  onClose: () => void;
}) {
  const config = CONFIG[kind];
  const isSupplier = kind === "suppliers";
  const open = editing != null;
  const row = editing && editing !== "new" ? editing : null;
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ nameAr?: string; nameEn?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNameAr(row?.primary ?? "");
    setNameEn(row?.secondary ?? "");
    setImagePath(row?.imagePath ?? null);
    setErrors({});
  }, [open, row]);

  const save = async () => {
    const next = {
      nameAr: nameAr.trim() ? undefined : isSupplier ? "أدخلي اسم المورد" : "أدخلي الاسم بالعربية",
      nameEn: isSupplier || nameEn.trim() ? undefined : "أدخلي الاسم بالإنجليزية"
    };
    setErrors(next);
    if (next.nameAr || next.nameEn) return;

    const id = row ? { id: row.id } : {};
    const input = isSupplier
      ? { ...id, name: nameAr.trim() }
      : {
          ...id,
          name: { ar: nameAr.trim(), en: nameEn.trim() },
          ...(config.imageLabel ? { imagePath } : {})
        };
    setSaving(true);
    try {
      await getStore().upsertProductAttribute(kind, input);
      onClose();
    } catch (error) {
      showErrorToast(error, "تعذر الحفظ. حاولي مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={row ? `تعديل ${config.noun}` : config.newLabel}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button variant="primary" onClick={() => { void save(); }} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ"}</Button>
        </>
      }
    >
      <div className="@container grid gap-5">
        {isSupplier ? (
          <Field label="اسم المورد" htmlFor="supplier-name" error={errors.nameAr}>
            <Input id="supplier-name" value={nameAr} aria-invalid={Boolean(errors.nameAr) || undefined} onChange={(event) => setNameAr(event.target.value)} />
          </Field>
        ) : (
          <div className="grid gap-x-4 gap-y-5 @lg:grid-cols-2">
            <BilingualNameFields
              arValue={nameAr}
              enValue={nameEn}
              onArChange={setNameAr}
              onEnChange={setNameEn}
              arError={errors.nameAr}
              enError={errors.nameEn}
            />
          </div>
        )}
        {config.imageLabel ? (
          <SingleImageField label={config.imageLabel} value={imagePath} onChange={setImagePath} uploadContext="products.update" disabled={saving} />
        ) : null}
      </div>
    </Modal>
  );
}

/** Brands, characters, age groups and suppliers: small lists chosen on a product, so they edit in a modal instead of a wizard. */
export function AttributeListPage({ kind }: { kind: ProductAttributeKind }) {
  const { user } = useAdminAuth();
  const config = CONFIG[kind];
  const source = useStore((state) => state[kind]) as Array<ProductAttribute | Supplier>;
  const loaded = useStore((state) => state.loaded);
  const list = usePaginatedList({ listId: kind, schema: LIST_SCHEMA });
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const reorderable = kind !== "suppliers";
  const reorder = useListReorder({
    persistedIds: useMemo(() => source.map((item) => item.id), [source]),
    save: (ids) => getStore().reorderProductAttributes(kind, ids),
    successMessage: "تم حفظ الترتيب.",
    errorMessage: "تعذر حفظ الترتيب. حاولي مرة أخرى."
  });

  const search = list.state.q.trim().toLowerCase();
  const rows = useMemo(() => {
    const ordered = sortByIdOrder(source, reorder.orderedIds).map(toRow);
    if (!search) return ordered;
    return ordered.filter((row) => row.primary.toLowerCase().includes(search) || row.secondary?.toLowerCase().includes(search));
  }, [reorder.orderedIds, search, source]);
  const sortedRows = useMemo(() => sortRows(rows, nameAccessors, list.state.sort), [list.state.sort, rows]);

  if (!canReadErpModule(user, "products")) {
    return <ForbiddenPage title={config.title} crumbs={[{ label: config.title }]} message="لا تملكين صلاحية الوصول إلى هذه الصفحة." />;
  }

  const canEdit = canUpdateErpModule(user, "products");
  const showReorder = reorderable && canEdit && !search && !list.state.sort && rows.length > 1;
  const pageRows = list.pageOf(sortedRows);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await getStore().deleteProductAttribute(kind, pendingDelete.id);
      setPendingDelete(null);
    } catch (error) {
      showErrorToast(error, "تعذر الحذف. حاولي مرة أخرى.");
    }
  };

  const Icon = config.icon;
  const hasImage = Boolean(config.imageLabel);

  return (
    <AdminShell
      title={config.title}
      crumbs={[{ label: config.title }]}
      description={config.description}
      actions={
        <>
          {reorder.isDirty && canEdit ? (
            <Button variant="secondary" onClick={() => { void reorder.saveOrder(); }} disabled={reorder.saving}>
              <Check /> حفظ الترتيب
            </Button>
          ) : null}
          {canEdit ? (
            <Button variant="primary" onClick={() => setEditing("new")}><Plus /> {config.newLabel}</Button>
          ) : null}
        </>
      }
    >
      <AdminListHeader
        searchPlaceholder="ابحثي بالاسم…"
        searchValue={list.searchInput}
        onSearchChange={list.setSearch}
        countLabel={loaded ? formatNumber(rows.length) : "جارٍ التحميل…"}
      />

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              <SortableTH direction={list.state.sort?.key === "name" ? list.state.sort.direction : null} onSort={() => list.toggleSort("name")}>
                الاسم
              </SortableTH>
              <TH className="w-px"><span className="sr-only">إجراءات</span></TH>
            </tr>
          </THead>
          <TBody aria-busy={!loaded}>
            {!loaded ? (
              <TableSkeletonRows
                cells={[
                  <TD key="lead" data-cell="lead"><Skeleton className="h-3.5 w-40" /></TD>,
                  <TD key="actions" data-cell="actions" />
                ]}
              />
            ) : null}
            {loaded && pageRows.map((row, index) => (
              <TR key={row.id}>
                <TD data-cell="lead">
                  <div className="flex min-w-0 items-center gap-3">
                    {hasImage ? <Thumb src={row.imagePath ? resolveMediaSrc(row.imagePath) : null} fallback={row.primary} /> : null}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text-strong">{row.primary}</p>
                      {row.secondary ? <p dir="ltr" className="mt-0.5 truncate text-end text-sm text-text-muted">{row.secondary}</p> : null}
                    </div>
                  </div>
                </TD>
                <TD data-cell="actions">
                  <div className="flex items-center justify-end gap-0.5">
                    {showReorder ? (
                      <ReorderButtons index={index} count={pageRows.length} className="gap-0.5" onMove={(_index, delta) => reorder.moveItem(row.id, delta)} />
                    ) : null}
                    {canEdit ? (
                      <RowMenu label={`إجراءات ${row.primary}`}>
                        <RowMenuItem onClick={() => setEditing(row)}><Pencil /> تعديل</RowMenuItem>
                        <RowMenuSeparator />
                        <RowMenuItem danger onClick={() => setPendingDelete(row)}><Trash2 /> حذف</RowMenuItem>
                      </RowMenu>
                    ) : null}
                  </div>
                </TD>
              </TR>
            ))}
            {loaded && rows.length === 0 ? (
              <TableEmptyRow
                colSpan={2}
                icon={<Icon />}
                title={source.length === 0 ? config.emptyTitle : "لا توجد نتائج تطابق البحث"}
                description={source.length === 0 ? config.emptyDescription : "جرّبي كلمة أخرى."}
              />
            ) : null}
          </TBody>
        </Table>
      </Card>

      <SmartPagination {...list.paginationProps(sortedRows.length, !loaded)} />

      <AttributeEditor kind={kind} editing={editing} onClose={() => setEditing(null)} />

      <AdminConfirmModal
        open={pendingDelete != null}
        title="تأكيد الحذف"
        onClose={() => setPendingDelete(null)}
        confirmLabel="حذف"
        tone="danger"
        onConfirm={confirmDelete}
      >
        <p>سيتم حذف «{pendingDelete?.primary}» نهائيًا. لا يمكن حذفه إذا كان مستخدمًا في أي منتج.</p>
      </AdminConfirmModal>
    </AdminShell>
  );
}
