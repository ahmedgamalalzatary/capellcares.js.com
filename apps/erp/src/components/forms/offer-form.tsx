"use client";

import { useRouter } from "next/navigation";
import { formatPrice } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { BilingualEditorField, BilingualNameFields, EditorActions, ImageFieldCard } from "./editor-form-parts";
import { ImageUpload } from "./image-upload";
import { RelatedItemsField } from "./related-items-field";
import { useOfferForm } from "../../hooks/forms/use-offer-form";
import type { OfferFormProps } from "../../types/forms/offer-form.types";

export function OfferForm({ mode, initial, products, relatedOptions = [], relatedItemsAvailable = true }: OfferFormProps) {
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
    rows,
    relatedItems,
    setRelatedItems,
    errors,
    relatedSelectableOptions,
    computed,
    addRow,
    removeRow,
    updateRow,
    save
  } = useOfferForm({ mode, initial, products, relatedOptions, relatedItemsAvailable });

  const savings = computed.originalTotal - Number(price || 0);

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
            <BilingualEditorField label="الوصف" arValue={descAr} onArChange={setDescAr} enValue={descEn} onEnChange={setDescEn} multiline />
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <h3 className="card__title">المنتجات داخل الباقة</h3>
            <button className="btn btn--ghost btn--sm" onClick={addRow}><Icon.Plus /> إضافة منتج</button>
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
                  <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--ink-3)" }}>أضيفي منتجًا للبدء.</td></tr>
                ) : rows.map((r, i) => {
                  const product = products.find((p) => p.id === r.productId);
                  const variants = product?.variants ?? [];
                  const variant = variants.find((v) => v.id === r.variantId);
                  return (
                    <tr key={i}>
                      <td style={{ minWidth: 220 }}>
                        <select className="select" value={r.productId} onChange={(e) => updateRow(i, { productId: Number(e.target.value) })}>
                          <option value="0">— اختاري منتجًا —</option>
                          {products.filter((p) => !p.deletedAt).map((p) => (
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
                      <td style={{ width: 100 }}>
                        <input className="input" type="number" min="1" value={r.qty} onChange={(e) => updateRow(i, { qty: Number(e.target.value) })} />
                      </td>
                      <td>{variant ? formatPrice(variant.price, "ar") : "—"}</td>
                      <td style={{ fontWeight: 600 }}>{variant ? formatPrice(variant.price * r.qty, "ar") : "—"}</td>
                      <td>
                        <button className="btn btn--ghost btn--sm" onClick={() => removeRow(i)} style={{ color: "var(--danger)" }}><Icon.Trash /></button>
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
          title="صورة العرض"
          error={errors.image}
          uploadSlot={<ImageUpload value={image} onChange={setImage} uploadContext={mode === "edit" ? "offers.update" : "offers.create"} />}
        />

        <section className="card">
          <div className="card__head"><h3 className="card__title">حسابات الباقة</h3></div>
          <div className="card__body stack">
            <div className="row row--between"><span className="muted">السعر الأصلي</span><span>{formatPrice(computed.originalTotal, "ar")}</span></div>
            <div className="row row--between"><span className="muted">سعر الباقة</span><span style={{ fontWeight: 600 }}>{formatPrice(Number(price || 0), "ar")}</span></div>
            <hr className="hr" />
            <div className="row row--between" style={{ fontWeight: 700 }}>
              <span>التوفير</span>
              <span style={{ color: savings > 0 ? "var(--success)" : "var(--ink)" }}>
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
