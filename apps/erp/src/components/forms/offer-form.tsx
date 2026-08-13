"use client";

import { useRouter } from "next/navigation";
import { formatPrice } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { CategoryPicker } from "./category-picker";
import { BilingualEditorField, BilingualNameFields, EditorActions, ImageFieldCard } from "./editor-form-parts";
import { EntityMediaUpload } from "./entity-media-upload";
import { RelatedItemsField } from "./related-items-field";
import { useOfferForm } from "../../hooks/forms/use-offer-form";
import type { OfferFormProps } from "../../types/forms/offer-form.types";
import { getDescendantCategoryIds } from "@/lib/category-tree";

export function OfferForm({ mode, initial, products, categories, relatedOptions = [], relatedItemsAvailable = true }: OfferFormProps) {
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
    youtubeUrl,
    setYoutubeUrl,
    media,
    setMedia,
    categoryId,
    setCategoryId,
    rows,
    relatedItems,
    setRelatedItems,
    errors,
    relatedSelectableOptions,
    computed,
    addRow,
    removeRow,
    moveRow,
    updateRow,
    save
  } = useOfferForm({ mode, initial, products, categories, relatedOptions, relatedItemsAvailable });

  const savings = computed.originalTotal - Number(price || 0);
  const rootCategories = categories.filter((category) => category.parentId == null);
  const allowedCategoryIds = categoryId != null ? getDescendantCategoryIds(categories, categoryId) : null;
  // A legacy offer opens with no category. Showing an empty product list there
  // would make its existing rows read as "nothing selected", so until a category
  // is picked every product stays listed; choosing one then prunes the rows.
  const categoryProducts = products.filter(
    (product) => !product.deletedAt && (allowedCategoryIds == null || allowedCategoryIds.has(product.categoryId))
  );

  return (
    <div className="editor-grid">
      <div className="stack stack--lg">
        <section className="card">
          <div className="card__head"><h3 className="card__title">معلومات العرض</h3></div>
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
                <label htmlFor="offer-price">سعر الباقة (جنيه)</label>
                <input id="offer-price" className="input" type="number" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                {errors.price && <span className="field-error">{errors.price}</span>}
              </div>
            </div>

            <div className="field">
              <label htmlFor="offer-category">القسم</label>
              <CategoryPicker id="offer-category" categories={rootCategories} value={categoryId} onChange={setCategoryId} />
              {errors.categoryId && <span className="field-error">{errors.categoryId}</span>}
            </div>

            <BilingualEditorField label="الوصف" arValue={descAr} onArChange={setDescAr} enValue={descEn} onEnChange={setDescEn} multiline />
            <div className="field">
              <label htmlFor="offer-youtube">رابط فيديو يوتيوب (اختياري)</label>
              <input id="offer-youtube" className="input" dir="ltr" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://youtube.com/…" />
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <h3 className="card__title">المنتجات داخل الباقة</h3>
            <button className="btn btn--ghost btn--sm" onClick={addRow}><Icon.Plus /> إضافة منتج</button>
          </div>
          <div className="card__body">
            {errors.rows && <div className="field-error field-error--spaced">{errors.rows}</div>}
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
                  <tr><td colSpan={6} className="state-note state-note--sm state-note--muted">أضيفي منتجًا للبدء.</td></tr>
                ) : rows.map((r, i) => {
                  const product = products.find((p) => p.id === r.productId);
                  const variants = product?.variants ?? [];
                  const variant = variants.find((v) => v.id === r.variantId);
                  return (
                    <tr key={i} data-testid="bundle-item-row">
                      <td className="cell-min-220">
                        <select className="select" value={r.productId} onChange={(e) => updateRow(i, { productId: Number(e.target.value) })}>
                          <option value="0">— اختاري منتجًا —</option>
                          {categoryProducts.map((p) => (
                            <option key={p.id} value={p.id}>{p.name.ar}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select className="select" disabled={!product} value={r.variantId} onChange={(e) => updateRow(i, { variantId: Number(e.target.value) })}>
                          <option value="0">— مقاس —</option>
                          {variants.map((v) => <option key={v.id} value={v.id}>{v.size}</option>)}
                        </select>
                      </td>
                      <td className="cell-w-100">
                        <input className="input" type="number" min="1" value={r.qty} onChange={(e) => updateRow(i, { qty: Number(e.target.value) })} />
                      </td>
                      <td>{variant ? formatPrice(variant.price, "ar") : "—"}</td>
                      <td className="fw-600">{variant ? formatPrice(variant.price * r.qty, "ar") : "—"}</td>
                      <td>
                        <div className="row row--gap-xs">
                          {rows.length > 1 && (
                            <>
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() => moveRow(i, -1)}
                                aria-label="تحريك لأعلى"
                                disabled={i === 0}
                              >
                                <Icon.Chevron size={14} className="rotate-180" />
                              </button>
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() => moveRow(i, 1)}
                                aria-label="تحريك لأسفل"
                                disabled={i === rows.length - 1}
                              >
                                <Icon.Chevron size={14} />
                              </button>
                            </>
                          )}
                          <button className="btn btn--ghost btn--sm c-error" onClick={() => removeRow(i)}><Icon.Trash /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Media needs the wide column — the 320px rail squeezed the AR/EN pair. */}
        <ImageFieldCard
          title="وسائط العرض"
          error={errors.image}
          uploadSlot={<EntityMediaUpload value={media} onChange={setMedia} uploadContext={mode === "edit" ? "offers.update" : "offers.create"} entityLabel="عرض" testIdPrefix="offer" />}
        />
      </div>

      <aside className="stack stack--lg">
        <section className="card">
          <div className="card__head"><h3 className="card__title">حسابات الباقة</h3></div>
          <div className="card__body stack">
            <div className="row row--between"><span className="muted">السعر الأصلي</span><span>{formatPrice(computed.originalTotal, "ar")}</span></div>
            <div className="row row--between"><span className="muted">سعر الباقة</span><span className="fw-600">{formatPrice(Number(price || 0), "ar")}</span></div>
            <hr className="hr" />
            <div className="row row--between fw-700">
              <span>التوفير</span>
              <span className="savings-amount" data-positive={savings > 0}>
                {formatPrice(Math.max(0, savings), "ar")}
              </span>
            </div>
            {savings < 0 && <p className="field-error">سعر الباقة أعلى من السعر الأصلي.</p>}
          </div>
        </section>

        <section className="card">
          <div className="card__head"><h3 className="card__title">العناصر المرتبطة</h3></div>
          <div className="card__body">
            {!relatedItemsAvailable && (
              <div className="field-error field-error--spaced">
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
          saveLabel={mode === "new" ? "حفظ العرض" : "حفظ التعديلات"}
          onCancel={() => router.push("/offers")}
          onSave={() => {
            void save().then((didSave) => {
              if (didSave) {
                router.push("/offers");
              }
            });
          }}
        />
      </aside>
    </div>
  );
}
