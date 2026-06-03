"use client";

import { useRouter } from "next/navigation";
import { formatPrice } from "@capella/shared";
import { CategoryPicker } from "./category-picker";
import { BilingualEditorField, BilingualNameFields, EditorActions, ImageFieldCard } from "./editor-form-parts";
import { ImageUpload } from "./image-upload";
import { useCollectionForm } from "../../hooks/forms/use-collection-form";
import { RelatedItemsField } from "./related-items-field";
import type { CollectionFormProps } from "../../types/forms/collection-form.types";
import { Icon } from "@/components/ui/icons";

export function CollectionForm({
  mode,
  initial,
  products,
  categories,
  relatedOptions = [],
  relatedItemsAvailable = true
}: CollectionFormProps) {
  const router = useRouter();
  const {
    nameAr,
    setNameAr,
    nameEn,
    setNameEn,
    descAr,
    setDescAr,
    descEn,
    setDescEn,
    price,
    setPrice,
    image,
    setImage,
    categoryId,
    setCategoryId,
    rows,
    relatedItems,
    setRelatedItems,
    errors,
    relatedSelectableOptions,
    originalTotal,
    addRow,
    removeRow,
    updateRow,
    save
  } = useCollectionForm({ mode, initial, products, categories, relatedOptions, relatedItemsAvailable });

  const savings = originalTotal - Number(price || 0);
  const categoryProducts = products.filter((product) => !product.deletedAt && product.categoryId === categoryId);

  return (
    <div className="editor-grid">
      <div className="stack stack--lg">
        <section className="card">
          <div className="card__head"><h3 className="card__title">معلومات المجموعة</h3></div>
          <div className="card__body stack stack--lg">
            <div className="editor-fields-2">
              <BilingualNameFields
                arValue={nameAr}
                enValue={nameEn}
                onArChange={setNameAr}
                onEnChange={setNameEn}
                arError={errors.nameAr}
                enError={errors.nameEn}
              />
              <div className="field">
                <label htmlFor="collection-price">السعر (جنيه)</label>
                <input id="collection-price" className="input" type="number" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                {errors.price && <span className="field-error">{errors.price}</span>}
              </div>
            </div>

            <div className="field">
              <label htmlFor="collection-category">القسم</label>
              <CategoryPicker id="collection-category" categories={categories} value={categoryId} onChange={setCategoryId} />
              {errors.categoryId && <span className="field-error">{errors.categoryId}</span>}
            </div>

            <BilingualEditorField label="الوصف" arValue={descAr} onArChange={setDescAr} enValue={descEn} onEnChange={setDescEn} multiline />
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <h3 className="card__title">المنتجات داخل المجموعة</h3>
            <button className="btn btn--ghost btn--sm" onClick={addRow} type="button">
              <Icon.Plus /> إضافة منتج
            </button>
          </div>
          <div className="card__body">
            {errors.rows && <div className="field-error" style={{ marginBottom: 10 }}>{errors.rows}</div>}
            <table className="table">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>المقاس</th>
                  <th>الكمية</th>
                  <th>السعر الفردي</th>
                  <th>المجموع</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--ink-3)" }}>أضيفي منتجين مختلفين على الأقل.</td></tr>
                ) : rows.map((row, index) => {
                  const product = products.find((candidate) => candidate.id === row.productId);
                  const variants = product?.variants ?? [];
                  const variant = variants.find((candidate) => candidate.id === row.variantId);
                  return (
                    <tr key={index}>
                      <td style={{ minWidth: 220 }}>
                        <select className="select" value={row.productId} onChange={(e) => updateRow(index, { productId: Number(e.target.value) })}>
                          <option value="0">— اختاري منتجًا —</option>
                          {categoryProducts.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>{candidate.name.ar}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select className="select" disabled={!product} value={row.variantId} onChange={(e) => updateRow(index, { variantId: Number(e.target.value) })}>
                          <option value="0">— مقاس —</option>
                          {variants.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>{candidate.size}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ width: 100 }}>
                        <input className="input" type="number" min="1" value={row.qty} onChange={(e) => updateRow(index, { qty: Number(e.target.value) })} />
                      </td>
                      <td>{variant ? formatPrice(variant.price, "ar") : "—"}</td>
                      <td style={{ fontWeight: 600 }}>{variant ? formatPrice(variant.price * row.qty, "ar") : "—"}</td>
                      <td>
                        <button className="btn btn--ghost btn--sm" onClick={() => removeRow(index)} style={{ color: "var(--danger)" }} type="button">
                          <Icon.Trash />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside className="stack stack--lg">
        <ImageFieldCard
          title="صورة المجموعة"
          error={errors.image}
          uploadSlot={<ImageUpload value={image} onChange={setImage} uploadContext={mode === "edit" ? "collections.update" : undefined} />}
        />

        <section className="card">
          <div className="card__head"><h3 className="card__title">حسابات المجموعة</h3></div>
          <div className="card__body stack">
            <div className="row row--between"><span className="muted">السعر الأصلي</span><span>{formatPrice(originalTotal, "ar")}</span></div>
            <div className="row row--between"><span className="muted">سعر المجموعة</span><span style={{ fontWeight: 600 }}>{formatPrice(Number(price || 0), "ar")}</span></div>
            <hr className="hr" />
            <div className="row row--between" style={{ fontWeight: 700 }}>
              <span>التوفير</span>
              <span style={{ color: savings > 0 ? "var(--success)" : "var(--ink)" }}>
                {formatPrice(Math.max(0, savings), "ar")}
              </span>
            </div>
            {savings < 0 && <p className="field-error">سعر المجموعة أعلى من السعر الأصلي.</p>}
          </div>
        </section>

        <section className="card">
          <div className="card__head"><h3 className="card__title">العناصر المرتبطة</h3></div>
          <div className="card__body">
            {!relatedItemsAvailable && (
              <div className="field-error" style={{ marginBottom: 10 }}>
                تعذر تحميل العناصر المرتبطة الحالية. يمكنك تعديل باقي البيانات، لكن تم تعطيل هذا القسم لتجنب حذف العلاقات الحالية.
              </div>
            )}
            <RelatedItemsField
              value={relatedItems ?? []}
              options={relatedSelectableOptions}
              onChange={setRelatedItems}
              disabled={!relatedItemsAvailable}
            />
          </div>
        </section>

        <EditorActions
          cancelLabel="إلغاء"
          saveLabel={mode === "new" ? "حفظ المجموعة" : "حفظ التعديلات"}
          onCancel={() => router.push("/collections")}
          onSave={() => {
            void save().then((didSave) => {
              if (didSave) {
                router.push("/collections");
              }
            });
          }}
        />
      </aside>
    </div>
  );
}
