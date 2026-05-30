"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Product, Category, ProductVariant, RelatedItemRef } from "@capella/shared";
import { getStore } from "@/lib/store";
import { Icon } from "@/components/ui/icons";
import { CategoryPicker } from "./category-picker";
import { BilingualEditorField, BilingualNameFields, ImageFieldCard } from "./editor-form-parts";
import { ProductHoverImageUpload } from "./product-hover-image-upload";
import { slugifyFormName } from "./form-slug";
import { ProductMediaUpload } from "./product-media-upload";
import { RelatedItemsField, type RelatedOption } from "./related-items-field";

interface Props {
  mode: "new" | "edit";
  initial?: Product;
  categories: Category[];
  relatedOptions?: RelatedOption[];
}

function newVariantId() {
  return Math.floor(Math.random() * 1_000_000) + 1_000_000;
}

type Requirement = {
  key: string;
  label: string;
  target: string;
  ok: boolean;
};

export function ProductForm({ mode, initial, categories, relatedOptions = [] }: Props) {
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
  const [media, setMedia] = useState(
    initial?.media ?? (initial?.imagePath ? [{ type: "image" as const, url: initial.imagePath }] : [])
  );
  const [hoverImagePath, setHoverImagePath] = useState(initial?.hoverImagePath ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(initial?.status ?? "inactive");
  const [isNew, setIsNew] = useState(initial?.isNew ?? false);
  const [isBestseller, setIsBestseller] = useState(initial?.isBestseller ?? false);
  const [variants, setVariants] = useState<ProductVariant[]>(
    initial?.variants ?? [{ id: newVariantId(), productId: 0, size: "", price: 0, stock: 0 }]
  );
  const [relatedItems, setRelatedItems] = useState<RelatedItemRef[]>(initial?.relatedItems ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // A product can never relate to itself.
  const relatedSelectableOptions = relatedOptions.filter(
    (option) => !(option.type === "product" && option.id === initial?.id)
  );

  const updateVariant = (id: number, patch: Partial<ProductVariant>) => {
    setVariants((vs) => vs.map((v) => v.id === id ? { ...v, ...patch } : v));
  };
  const addVariant = () => setVariants((vs) => [...vs, { id: newVariantId(), productId: 0, size: "", price: 0, stock: 0 }]);
  const removeVariant = (id: number) => setVariants((vs) => vs.length === 1 ? vs : vs.filter((v) => v.id !== id));

  const requirements: Requirement[] = useMemo(() => [
    { key: "nameAr", label: "الاسم بالعربية", target: "section-basics", ok: nameAr.trim().length > 0 },
    { key: "nameEn", label: "Name (EN)", target: "section-basics", ok: nameEn.trim().length > 0 },
    { key: "buyingPrice", label: "سعر الشراء", target: "section-basics", ok: !!buyingPrice && buyingPrice > 0 },
    { key: "keywords", label: "كلمات مفتاحية", target: "section-basics", ok: keywords.trim().length > 0 },
    { key: "categoryId", label: "اختيار قسم", target: "section-publish", ok: !!categoryId },
    { key: "image", label: "صورة المنتج", target: "section-media", ok: media.some((item) => item.type === "image") },
    { key: "variants", label: "مقاس وسعر", target: "section-variants", ok: variants.length > 0 && variants.every((v) => v.size.trim() && v.price > 0) }
  ], [nameAr, nameEn, buyingPrice, keywords, categoryId, media, variants]);

  const completedCount = requirements.filter((r) => r.ok).length;
  const totalCount = requirements.length;
  const missing = requirements.filter((r) => !r.ok);
  const canActivate = missing.length === 0;

  const scrollTo = (id: string) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
      if (!media.some((item) => item.type === "image")) e.image = "أضيفي صورة المنتج";
    } else {
      if (!nameAr.trim() && !nameEn.trim()) e.nameAr = "أدخلي اسم المنتج بالعربية أو الإنجليزية على الأقل";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!canSave()) return;
    const id = initial?.id;
    const slug = initial?.slug ?? slugifyFormName(nameEn || nameAr || "product");
    const primaryImage = media.find((item) => item.type === "image")?.url ?? "";
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
      imagePath: primaryImage,
      hoverImagePath,
      media,
      youtubeUrl: youtubeUrl.trim() || undefined,
      status,
      isNew,
      isBestseller,
      categoryId: categoryId ?? 0,
      variants: variants.map((v, i) => ({ ...v, productId: id ?? 0, sortOrder: i + 1, stock: Math.max(0, v.stock), price: Math.max(0, v.price) })),
      offerIds: initial?.offerIds ?? [],
      relatedItems,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null
    };
    await getStore().upsertProduct(product);
    router.push("/products");
  };

  const heroTitle = nameAr.trim() || nameEn.trim();
  const eyebrow = mode === "new" ? "منتج جديد · مسودة" : "تعديل منتج";
  const sub = mode === "edit" && initial?.sku ? `SKU · ${initial.sku}` : "اكتمال البيانات يفعّل ظهور المنتج في المتجر";

  return (
    <div className="stack stack--lg">
      <header className="editor-hero">
        <div className="editor-hero__lead">
          <div className="editor-hero__eyebrow">{eyebrow}</div>
          {heroTitle ? (
            <h2 className="editor-hero__title">{heroTitle}</h2>
          ) : (
            <h2 className="editor-hero__title editor-hero__title--placeholder">بدون اسم بعد…</h2>
          )}
          <div className="editor-hero__sub">{sub}</div>
        </div>
        <div className="editor-hero__meta">
          <span className={`status status--${status}`}>{status === "active" ? "نشط" : "غير نشط"}</span>
          <div className={`completion-meter${canActivate ? " completion-meter--done" : ""}`}>
            <div className="completion-meter__head">
              <span>اكتمال البيانات</span>
              <span className="completion-meter__count">{completedCount} / {totalCount}</span>
            </div>
            <div className="completion-meter__bar">
              <div
                className="completion-meter__fill"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="editor-grid-v2">
        <div className="stack stack--lg">
          <section className="card" id="section-basics">
            <div className="card__head">
              <div className="section-num">
                <span className="section-num__digit">01</span>
                <span className="section-num__rule" />
                <h3 className="card__title">المعلومات الأساسية</h3>
              </div>
            </div>
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
            <div className="card__head">
              <div className="section-num">
                <span className="section-num__digit">02</span>
                <span className="section-num__rule" />
                <h3 className="card__title">المحتوى التسويقي</h3>
              </div>
            </div>
            <div className="card__body stack stack--lg">
              <BilingualEditorField label="الوصف" arValue={descAr} onArChange={setDescAr} enValue={descEn} onEnChange={setDescEn} multiline />
              <BilingualEditorField label="المكونات" arValue={ingAr} onArChange={setIngAr} enValue={ingEn} onEnChange={setIngEn} multiline />
              <BilingualEditorField label="طريقة الاستخدام" arValue={useAr} onArChange={setUseAr} enValue={useEn} onEnChange={setUseEn} multiline />
              <BilingualEditorField label="تحذيرات" arValue={warnAr} onArChange={setWarnAr} enValue={warnEn} onEnChange={setWarnEn} multiline />
            </div>
          </section>

          <section className="card" id="section-variants">
            <div className="card__head">
              <div className="section-num">
                <span className="section-num__digit">03</span>
                <span className="section-num__rule" />
                <h3 className="card__title">المقاسات والمخزون</h3>
              </div>
              <button className="btn btn--soft btn--sm" onClick={addVariant}><Icon.Plus /> إضافة مقاس</button>
            </div>
            <div className="card__body">
              {errors.variants && <div className="field-error" style={{ marginBottom: 10 }}>{errors.variants}</div>}
              <div className="variant-rows">
                {variants.map((v) => (
                  <div className="variant-row" key={v.id}>
                    <div className="field">
                      <label>المقاس</label>
                      <input className="input" value={v.size} onChange={(e) => updateVariant(v.id, { size: e.target.value })} placeholder="100ml" />
                    </div>
                    <div className="field">
                      <label>السعر</label>
                      <input className="input" type="number" min="0" value={v.price} onChange={(e) => updateVariant(v.id, { price: Number(e.target.value) })} />
                    </div>
                    <div className="field">
                      <label>المخزون</label>
                      <input className="input" type="number" min="0" value={v.stock} onChange={(e) => updateVariant(v.id, { stock: Number(e.target.value) })} />
                    </div>
                    <button
                      type="button"
                      className="variant-row__remove"
                      disabled={variants.length === 1}
                      onClick={() => removeVariant(v.id)}
                      aria-label="حذف المقاس"
                    >
                      <Icon.Trash />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="editor-rail" id="section-publish">
          <section className="card">
            <div className="card__head">
              <div className="section-num">
                <span className="section-num__digit">04</span>
                <span className="section-num__rule" />
                <h3 className="card__title">النشر</h3>
              </div>
            </div>
            <div className="card__body stack stack--lg">
              <div className="status-tiles">
                <label
                  className="status-tile"
                  data-checked={status === "inactive"}
                  data-tone="inactive"
                >
                  <input type="radio" name="st" checked={status === "inactive"} onChange={() => setStatus("inactive")} />
                  <span className="status-tile__label"><span className="status-tile__dot" /> مسودة</span>
                  <span className="status-tile__hint">مخفي عن المتجر — للعمل عليه دون نشر.</span>
                </label>
                <label
                  className="status-tile"
                  data-checked={status === "active"}
                  data-tone="active"
                >
                  <input type="radio" name="st" checked={status === "active"} onChange={() => setStatus("active")} />
                  <span className="status-tile__label"><span className="status-tile__dot" /> نشط</span>
                  <span className="status-tile__hint">يظهر فورًا في صفحات المتجر.</span>
                </label>
              </div>

              <div className="stack" style={{ gap: 8 }}>
                <label className="check">
                  <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} />
                  شارة «جديد»
                </label>
                <label className="check">
                  <input type="checkbox" checked={isBestseller} onChange={(e) => setIsBestseller(e.target.checked)} />
                  شارة «الأكثر مبيعًا»
                </label>
              </div>

              <div className="field">
                <label>القسم</label>
                <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
                {errors.categoryId && <div className="field-error" style={{ marginTop: 6 }}>{errors.categoryId}</div>}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <div className="section-num">
                <span className="section-num__digit">05</span>
                <span className="section-num__rule" />
                <h3 className="card__title">العناصر المرتبطة</h3>
              </div>
            </div>
            <div className="card__body">
              <RelatedItemsField
                value={relatedItems}
                options={relatedSelectableOptions}
                onChange={setRelatedItems}
              />
            </div>
          </section>

          <ImageFieldCard
            title="وسائط المنتج"
            error={errors.image}
            uploadSlot={
              <div id="section-media">
                <ProductMediaUpload value={media} onChange={setMedia} />
              </div>
            }
          />

          <ImageFieldCard
            title="صورة Hover لبطاقة المنتج"
            uploadSlot={<ProductHoverImageUpload value={hoverImagePath} onChange={setHoverImagePath} />}
          />
        </aside>
      </div>

      <div className="save-bar">
        <div className="save-bar__hints">
          {canActivate ? (
            <span className="save-bar__hints--ready">جاهز للتفعيل · جميع البيانات مكتملة.</span>
          ) : (
            <>
              <span className="save-bar__hints-lead">المتبقي للتفعيل</span>
              {missing.map((m) => (
                <button
                  type="button"
                  key={m.key}
                  className="save-bar__hint"
                  onClick={() => scrollTo(m.target)}
                >
                  {m.label}
                </button>
              ))}
            </>
          )}
        </div>
        <div className="save-bar__actions">
          <button type="button" className="btn btn--ghost" onClick={() => router.push("/products")}>إلغاء</button>
          <button type="button" className="btn btn--primary" onClick={() => { void save(); }}>
            {mode === "new" ? "حفظ المنتج" : "حفظ التعديلات"}
          </button>
        </div>
      </div>
    </div>
  );
}
