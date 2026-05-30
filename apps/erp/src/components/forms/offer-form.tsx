"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Offer, OfferItem, Product, RelatedItemRef } from "@capella/shared";
import { formatPrice } from "@capella/shared";
import { getStore } from "@/lib/store";
import { Icon } from "@/components/ui/icons";
import { BilingualEditorField, BilingualNameFields, EditorActions, ImageFieldCard } from "./editor-form-parts";
import { slugifyFormName } from "./form-slug";
import { ImageUpload } from "./image-upload";
import { RelatedItemsField, type RelatedOption } from "./related-items-field";

interface Props {
  mode: "new" | "edit";
  initial?: Offer;
  products: Product[];
  relatedOptions?: RelatedOption[];
  relatedItemsAvailable?: boolean;
}

interface Row { id?: number; productId: number; variantId: number; qty: number }

export function OfferForm({ mode, initial, products, relatedOptions = [], relatedItemsAvailable = true }: Props) {
  const router = useRouter();
  const [nameAr, setNameAr] = useState(initial?.name.ar ?? "");
  const [nameEn, setNameEn] = useState(initial?.name.en ?? "");
  const [descAr, setDescAr] = useState(initial?.description.ar ?? "");
  const [descEn, setDescEn] = useState(initial?.description.en ?? "");
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [image, setImage] = useState<string | null>(initial?.imagePath ?? null);
  const [rows, setRows] = useState<Row[]>(() => {
    if (!initial) return [];
    return initial.items.map((it) => {
      const product = products.find((p) => p.variants.some((v) => v.id === it.variantId));
      return { id: it.id, productId: product?.id ?? 0, variantId: it.variantId, qty: it.qty };
    });
  });
  const [relatedItems, setRelatedItems] = useState<RelatedItemRef[] | undefined>(initial?.relatedItems);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // An offer can never relate to itself.
  const relatedSelectableOptions = relatedOptions.filter(
    (option) => !(option.type === "offer" && option.id === initial?.id)
  );

  const computed = useMemo(() => {
    let originalTotal = 0;
    const breakdown = rows.map((r) => {
      const product = products.find((p) => p.id === r.productId);
      const variant = product?.variants.find((v) => v.id === r.variantId);
      const subtotal = (variant?.price ?? 0) * r.qty;
      originalTotal += subtotal;
      return { product, variant, subtotal, row: r };
    });
    return { originalTotal, breakdown };
  }, [rows, products]);

  const addRow = () => setRows((s) => [...s, { productId: 0, variantId: 0, qty: 1 }]);
  const removeRow = (i: number) => setRows((s) => s.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows((s) => {
      const next = [...s];
      next[i] = { ...next[i], ...patch };
      if (patch.productId != null) {
        next[i].id = undefined;
        next[i].variantId = 0;
      }
      if (patch.variantId != null && patch.variantId !== s[i]?.variantId) {
        next[i].id = undefined;
      }
      return next;
    });
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (!nameAr.trim()) e.nameAr = "مطلوب";
    if (!nameEn.trim()) e.nameEn = "مطلوب";
    if (price <= 0) e.price = "أدخلي سعرًا للعرض";
    if (!image) e.image = "أضيفي صورة";
    if (rows.length === 0) e.rows = "أضيفي منتجًا واحدًا على الأقل";
    if (rows.some((r) => !r.productId || !r.variantId || r.qty <= 0)) e.rows = "أكملي بيانات كل عنصر";
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const id = initial?.id;
    const slug = initial?.slug ?? slugifyFormName(nameEn);
    const items: OfferItem[] = rows.map((r) => ({ id: r.id, variantId: r.variantId, qty: r.qty }));
    const offer: Omit<Offer, "id"> & { id?: number } = {
      id,
      slug,
      name: { ar: nameAr.trim(), en: nameEn.trim() },
      description: { ar: descAr, en: descEn },
      imagePath: image ?? "",
      price: Number(price),
      originalTotal: computed.originalTotal,
      stock: initial?.stock ?? 0,
      items,
      status: "active",
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null
    };
    if (relatedItems !== undefined) {
      offer.relatedItems = relatedItems;
    }
    await getStore().upsertOffer(offer);
    router.push("/offers");
  };

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
                <label>سعر الباقة (جنيه)</label>
                <input className="input" type="number" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
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
          uploadSlot={<ImageUpload value={image} onChange={setImage} />}
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
            void save();
          }}
        />
      </aside>
    </div>
  );
}
