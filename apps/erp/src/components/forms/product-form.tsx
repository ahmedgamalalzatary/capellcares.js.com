"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useProductForm } from "../../hooks/forms/use-product-form";
import { Icon } from "@/components/ui/icons";
import { CategoryPicker } from "./category-picker";
import { BilingualEditorField, BilingualNameFields, ImageFieldCard } from "./editor-form-parts";
import { ProductHoverImageUpload } from "./product-hover-image-upload";
import { ProductMediaUpload } from "./product-media-upload";
import { RelatedItemsField } from "./related-items-field";
import "./product-form.css";
import type { ProductFormProps } from "../../types/forms/product-form.types";

export function ProductForm({ mode, initial, categories, relatedOptions = [], relatedItemsAvailable = true }: ProductFormProps) {
  const router = useRouter();
  const {
    nameAr, setNameAr,
    nameEn, setNameEn,
    descAr, setDescAr,
    descEn, setDescEn,
    ingAr, setIngAr,
    ingEn, setIngEn,
    useAr, setUseAr,
    useEn, setUseEn,
    warnAr, setWarnAr,
    warnEn, setWarnEn,
    sku, setSku,
    buyingPrice, setBuyingPrice,
    keywords, setKeywords,
    youtubeUrl, setYoutubeUrl,
    categoryId, setCategoryId,
    media, setMedia,
    arHoverImagePath, setArHoverImagePath,
    enHoverImagePath, setEnHoverImagePath,
    status, setStatus,
    isNew, setIsNew,
    isBestseller, setIsBestseller,
    variants,
    relatedItems,
    setRelatedItems,
    errors,
    relatedSelectableOptions,
    updateVariant,
    addVariant,
    removeVariant,
    completedCount,
    totalCount,
    missing,
    canActivate,
    save
  } = useProductForm({ initial, relatedOptions });

  const scrollTo = (id: string) => {
    if (typeof document === "undefined") return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
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
                style={{ "--completion": `${(completedCount / totalCount) * 100}%` } as CSSProperties}
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
                  <label htmlFor="product-sku">SKU</label>
                  <input id="product-sku" className="input" dir="ltr" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="BODY-LOTION-ROSE-200ML" />
                </div>
                <div className="field">
                  <label htmlFor="product-buying-price">سعر الشراء (للداخلية)</label>
                  <input id="product-buying-price" className="input" type="number" min="0" value={buyingPrice} onChange={(e) => setBuyingPrice(Number(e.target.value))} />
                  {errors.buyingPrice && <span className="field-error">{errors.buyingPrice}</span>}
                </div>
                <div className="field field--full">
                  <label htmlFor="product-keywords">كلمات مفتاحية (مفصولة بفواصل أو أسطر جديدة)</label>
                  <textarea id="product-keywords" className="textarea" rows={3} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="ورد, لوشن, ترطيب" />
                  {errors.keywords && <span className="field-error">{errors.keywords}</span>}
                </div>
                <div className="field field--full">
                  <label htmlFor="product-youtube">رابط فيديو يوتيوب (اختياري)</label>
                  <input id="product-youtube" className="input" dir="ltr" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/…" />
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
              {errors.variants && <div className="field-error field-error--spaced">{errors.variants}</div>}
              <div className="variant-rows">
                {variants.map((v) => (
                  <div className="variant-row" key={v.id}>
                    <div className="field">
                      <label htmlFor={`variant-size-${v.id}`}>المقاس</label>
                      <input id={`variant-size-${v.id}`} className="input" value={v.size} onChange={(e) => updateVariant(v.id, { size: e.target.value })} placeholder="100ml" />
                    </div>
                    <div className="field">
                      <label htmlFor={`variant-price-${v.id}`}>السعر</label>
                      <input id={`variant-price-${v.id}`} className="input" type="number" min="0" value={v.price} onChange={(e) => updateVariant(v.id, { price: Number(e.target.value) })} />
                    </div>
                    <div className="field">
                      <label htmlFor={`variant-stock-${v.id}`}>المخزون</label>
                      <input id={`variant-stock-${v.id}`} className="input" type="number" min="0" value={v.stock} onChange={(e) => updateVariant(v.id, { stock: Number(e.target.value) })} />
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

              <div className="stack stack--sm">
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
                <label htmlFor="product-category">القسم</label>
                <CategoryPicker id="product-category" categories={categories} value={categoryId} onChange={setCategoryId} />
                {errors.categoryId && <div className="field-error field-error--offset">{errors.categoryId}</div>}
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

          <ImageFieldCard
            title="وسائط المنتج"
            error={errors.image}
            uploadSlot={
              <div id="section-media">
                <ProductMediaUpload value={media} onChange={setMedia} uploadContext={mode === "edit" ? "products.update" : "products.create"} />
              </div>
            }
          />

          <ImageFieldCard
            title="صورة Hover لبطاقة المنتج"
            uploadSlot={<ProductHoverImageUpload
              arValue={arHoverImagePath}
              enValue={enHoverImagePath}
              onChange={(lang, value) => lang === "ar" ? setArHoverImagePath(value) : setEnHoverImagePath(value)}
              uploadContext={mode === "edit" ? "products.update" : "products.create"}
            />}
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
          <button type="button" className="btn btn--primary" onClick={async () => {
            const saved = await save();
            if (saved) {
              router.push("/products");
            }
          }}>
            {mode === "new" ? "حفظ المنتج" : "حفظ التعديلات"}
          </button>
        </div>
      </div>
    </div>
  );
}
