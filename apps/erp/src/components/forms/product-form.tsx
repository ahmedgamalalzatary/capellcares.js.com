"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Product, Category, ProductVariant } from "@capella/shared";
import { getStore } from "@/lib/store";
import { Icon } from "@/components/ui/icons";
import { CategoryPicker } from "./category-picker";
import { ImageUpload } from "./image-upload";

interface Props {
  mode: "new" | "edit";
  initial?: Product;
  categories: Category[];
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function newVariantId() {
  return Math.floor(Math.random() * 1_000_000) + 1_000_000;
}

export function ProductForm({ mode, initial, categories }: Props) {
  const router = useRouter();
  const [nameAr, setNameAr] = useState(initial?.name.ar ?? "");
  const [nameEn, setNameEn] = useState(initial?.name.en ?? "");
  const [descAr, setDescAr] = useState(initial?.description.ar ?? "");
  const [descEn, setDescEn] = useState(initial?.description.en ?? "");
  const [ingAr, setIngAr] = useState(initial?.ingredients.ar ?? "");
  const [ingEn, setIngEn] = useState(initial?.ingredients.en ?? "");
  const [useAr, setUseAr] = useState(initial?.howToUse.ar ?? "");
  const [useEn, setUseEn] = useState(initial?.howToUse.en ?? "");
  const [warnAr, setWarnAr] = useState(initial?.warnings.ar ?? "");
  const [warnEn, setWarnEn] = useState(initial?.warnings.en ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [buyingPrice, setBuyingPrice] = useState(initial?.buyingPrice ?? 0);
  const [keywords, setKeywords] = useState((initial?.keywords ?? []).join(", "));
  const [youtubeUrl, setYoutubeUrl] = useState(initial?.youtubeUrl ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null);
  const [image, setImage] = useState<string | null>(initial?.imagePath ?? null);
  const [status, setStatus] = useState<"active" | "inactive">(initial?.status ?? "inactive");
  const [isNew, setIsNew] = useState(initial?.isNew ?? false);
  const [isBestseller, setIsBestseller] = useState(initial?.isBestseller ?? false);
  const [variants, setVariants] = useState<ProductVariant[]>(
    initial?.variants ?? [{ id: newVariantId(), productId: 0, size: "", price: 0, stock: 0 }]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateVariant = (id: number, patch: Partial<ProductVariant>) => {
    setVariants((vs) => vs.map((v) => v.id === id ? { ...v, ...patch } : v));
  };
  const addVariant = () => setVariants((vs) => [...vs, { id: newVariantId(), productId: 0, size: "", price: 0, stock: 0 }]);
  const removeVariant = (id: number) => setVariants((vs) => vs.length === 1 ? vs : vs.filter((v) => v.id !== id));

  const wantActive = status === "active";
  const canSave = () => {
    const e: Record<string, string> = {};
    if (wantActive) {
      if (!nameAr.trim()) e.nameAr = "مطلوب لتفعيل المنتج";
      if (!nameEn.trim()) e.nameEn = "مطلوب لتفعيل المنتج";
      if (!buyingPrice || buyingPrice <= 0) e.buyingPrice = "أدخلي سعر شراء أكبر من صفر";
      if (variants.length === 0 || variants.some((v) => !v.size.trim() || v.price <= 0)) e.variants = "أضيفي مقاسًا واحدًا على الأقل مع سعر صحيح";
      if (!categoryId) e.categoryId = "اختاري قسمًا";
      if (!keywords.trim()) e.keywords = "أضيفي كلمات مفتاحية";
      if (!image) e.image = "أضيفي صورة المنتج";
    } else {
      if (!nameAr.trim() && !nameEn.trim()) e.nameAr = "أدخلي اسم المنتج بالعربية أو الإنجليزية على الأقل";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!canSave()) return;
    const id = initial?.id;
    const slug = initial?.slug ?? slugify(nameEn || nameAr || "product");
    const product: Product = {
      id: id ?? 0,
      sku: sku.trim() || `SKU-${Date.now()}`,
      slug,
      name: { ar: nameAr, en: nameEn },
      description: { ar: descAr, en: descEn },
      ingredients: { ar: ingAr, en: ingEn },
      howToUse: { ar: useAr, en: useEn },
      warnings: { ar: warnAr, en: warnEn },
      keywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
      buyingPrice: Number(buyingPrice) || 0,
      imagePath: image ?? "",
      youtubeUrl: youtubeUrl.trim() || undefined,
      status,
      isNew,
      isBestseller,
      categoryId: categoryId ?? 0,
      variants: variants.map((v, i) => ({ ...v, productId: id ?? 0, sortOrder: i + 1, stock: Math.max(0, v.stock), price: Math.max(0, v.price) })),
      offerIds: initial?.offerIds ?? [],
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null
    };
    await getStore().upsertProduct(product);
    router.push("/products");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
      <div className="stack stack--lg">
        <section className="card">
          <div className="card__head"><h3 className="card__title">المعلومات الأساسية</h3></div>
          <div className="card__body stack stack--lg">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="field">
                <label>الاسم بالعربية</label>
                <input className="input" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
                {errors.nameAr && <span className="field-error">{errors.nameAr}</span>}
              </div>
              <div className="field">
                <label>Name (English)</label>
                <input className="input" dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
                {errors.nameEn && <span className="field-error">{errors.nameEn}</span>}
              </div>
              <div className="field">
                <label>SKU</label>
                <input className="input" dir="ltr" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="BODY-LOTION-ROSE-200ML" />
              </div>
              <div className="field">
                <label>سعر الشراء (للداخلية)</label>
                <input className="input" type="number" min="0" value={buyingPrice} onChange={(e) => setBuyingPrice(Number(e.target.value))} />
                {errors.buyingPrice && <span className="field-error">{errors.buyingPrice}</span>}
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>كلمات مفتاحية (مفصولة بفواصل)</label>
                <input className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="ورد, لوشن, ترطيب" />
                {errors.keywords && <span className="field-error">{errors.keywords}</span>}
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>رابط فيديو يوتيوب (اختياري)</label>
                <input className="input" dir="ltr" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/…" />
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__head"><h3 className="card__title">المحتوى التسويقي</h3></div>
          <div className="card__body stack stack--lg">
            <BilingualField label="الوصف" arVal={descAr} setAr={setDescAr} enVal={descEn} setEn={setDescEn} multiline />
            <BilingualField label="المكونات" arVal={ingAr} setAr={setIngAr} enVal={ingEn} setEn={setIngEn} multiline />
            <BilingualField label="طريقة الاستخدام" arVal={useAr} setAr={setUseAr} enVal={useEn} setEn={setUseEn} multiline />
            <BilingualField label="تحذيرات" arVal={warnAr} setAr={setWarnAr} enVal={warnEn} setEn={setWarnEn} multiline />
          </div>
        </section>

        <section className="card">
          <div className="card__head">
            <h3 className="card__title">المقاسات والمخزون</h3>
            <button className="btn btn--ghost btn--sm" onClick={addVariant}><Icon.Plus /> إضافة مقاس</button>
          </div>
          <div className="card__body">
            {errors.variants && <div className="field-error" style={{ marginBottom: 10 }}>{errors.variants}</div>}
            <table className="table">
              <thead>
                <tr>
                  <th>المقاس</th>
                  <th>السعر</th>
                  <th>المخزون</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id}>
                    <td><input className="input" value={v.size} onChange={(e) => updateVariant(v.id, { size: e.target.value })} placeholder="100ml" /></td>
                    <td><input className="input" type="number" min="0" value={v.price} onChange={(e) => updateVariant(v.id, { price: Number(e.target.value) })} /></td>
                    <td><input className="input" type="number" min="0" value={v.stock} onChange={(e) => updateVariant(v.id, { stock: Number(e.target.value) })} /></td>
                    <td>
                      <button className="btn btn--ghost btn--sm" disabled={variants.length === 1} onClick={() => removeVariant(v.id)} style={{ color: "var(--danger)" }}>
                        <Icon.Trash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside className="stack stack--lg">
        <section className="card">
          <div className="card__head"><h3 className="card__title">الحالة</h3></div>
          <div className="card__body stack">
            <label className="check"><input type="radio" name="st" checked={status === "inactive"} onChange={() => setStatus("inactive")} /> غير نشط (مسودة)</label>
            <label className="check"><input type="radio" name="st" checked={status === "active"} onChange={() => setStatus("active")} /> نشط (يظهر في المتجر)</label>
            {status === "active" && (
              <p className="muted" style={{ fontSize: 12 }}>
                لتفعيل المنتج يجب اكتمال الاسمين، السعر، صورة، قسم نهائي، كلمات مفتاحية، ومقاس واحد على الأقل.
              </p>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card__head"><h3 className="card__title">شارات المتجر</h3></div>
          <div className="card__body stack">
            <label className="check">
              <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} />
              جديد
            </label>
            <label className="check">
              <input type="checkbox" checked={isBestseller} onChange={(e) => setIsBestseller(e.target.checked)} />
              الأكثر مبيعًا
            </label>
          </div>
        </section>

        <section className="card">
          <div className="card__head"><h3 className="card__title">القسم</h3></div>
          <div className="card__body">
            <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
            {errors.categoryId && <div className="field-error" style={{ marginTop: 6 }}>{errors.categoryId}</div>}
          </div>
        </section>

        <section className="card">
          <div className="card__head"><h3 className="card__title">صورة المنتج</h3></div>
          <div className="card__body">
            <ImageUpload value={image} onChange={setImage} />
            {errors.image && <div className="field-error" style={{ marginTop: 6 }}>{errors.image}</div>}
          </div>
        </section>

        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn--ghost" onClick={() => router.push("/products")}>إلغاء</button>
          <button className="btn btn--primary" onClick={save}>{mode === "new" ? "حفظ المنتج" : "حفظ التعديلات"}</button>
        </div>
      </aside>
    </div>
  );
}

function BilingualField({
  label, arVal, setAr, enVal, setEn, multiline
}: {
  label: string;
  arVal: string; setAr: (v: string) => void;
  enVal: string; setEn: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {multiline ? (
          <textarea className="textarea" placeholder="العربية" value={arVal} onChange={(e) => setAr(e.target.value)} />
        ) : (
          <input className="input" placeholder="العربية" value={arVal} onChange={(e) => setAr(e.target.value)} />
        )}
        {multiline ? (
          <textarea className="textarea" dir="ltr" placeholder="English" value={enVal} onChange={(e) => setEn(e.target.value)} />
        ) : (
          <input className="input" dir="ltr" placeholder="English" value={enVal} onChange={(e) => setEn(e.target.value)} />
        )}
      </div>
    </div>
  );
}
