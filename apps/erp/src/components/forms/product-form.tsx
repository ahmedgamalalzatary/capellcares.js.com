"use client";

import { useRouter } from "next/navigation";
import { useProductForm } from "../../hooks/forms/use-product-form";
import { Icon } from "@/components/ui/icons";
import { CategoryPicker } from "./category-picker";
import { ColorSwatchField } from "./color-swatch-field";
import { BilingualEditorField, BilingualNameFields, ImageFieldCard } from "./editor-form-parts";
import { ProductHoverImageUpload } from "./product-hover-image-upload";
import { ProductMediaUpload } from "./product-media-upload";
import { RelatedItemsField } from "./related-items-field";
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
    hoverImagePath, setHoverImagePath,
    status, setStatus,
    isNew, setIsNew,
    isBestseller, setIsBestseller,
    sizes,
    colors,
    variants,
    relatedItems,
    setRelatedItems,
    errors,
    relatedSelectableOptions,
    updateVariant,
    updateSize,
    addSize,
    removeSize,
    updateColor,
    addColor,
    removeColor,
    completedCount,
    totalCount,
    canActivate,
    save
  } = useProductForm({ initial, relatedOptions });

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
          <div className="editor-hero__actions">
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
                  <label htmlFor="product-sku">SKU</label>
                  <input id="product-sku" className="input" dir="ltr" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="BODY-LOTION-ROSE-200ML" />
                </div>
                <div className="field">
                  <label htmlFor="product-buying-price">سعر الشراء (للداخلية)</label>
                  <input id="product-buying-price" className="input" type="number" min="0" value={buyingPrice} onChange={(e) => setBuyingPrice(Number(e.target.value))} />
                  {errors.buyingPrice && <span className="field-error">{errors.buyingPrice}</span>}
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="product-keywords">كلمات مفتاحية (مفصولة بفواصل)</label>
                  <input id="product-keywords" className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="ورد, لوشن, ترطيب" />
                  {errors.keywords && <span className="field-error">{errors.keywords}</span>}
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
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
                <h3 className="card__title">خيارات البيع والمخزون</h3>
              </div>
            </div>
            <div className="card__body stack stack--lg">
              {errors.variants && <div className="field-error" style={{ marginBottom: 10 }}>{errors.variants}</div>}
              <div className="product-options-grid">
                <div className="product-option-panel">
                  <div className="product-option-panel__head">
                    <div>
                      <strong>المقاسات</strong>
                      <span>نص حر مثل 100ml أو XL</span>
                    </div>
                    <button type="button" className="btn btn--soft btn--sm" onClick={addSize}><Icon.Plus /> إضافة</button>
                  </div>
                  <div className="product-option-list">
                    {sizes.map((size, index) => (
                      <div className="product-option-row" key={size.id}>
                        <span className="product-option-row__index">{String(index + 1).padStart(2, "0")}</span>
                        <input className="input" value={size.label} onChange={(event) => updateSize(size.id, event.target.value)} placeholder="100ml" />
                        <button type="button" className="variant-row__remove" disabled={sizes.length === 1} onClick={() => removeSize(size.id)} aria-label="حذف المقاس"><Icon.Trash /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="product-option-panel">
                  <div className="product-option-panel__head">
                    <div>
                      <strong>الألوان</strong>
                      <span>القيمة المحفوظة Hex فقط</span>
                    </div>
                    <button type="button" className="btn btn--soft btn--sm" onClick={addColor}><Icon.Plus /> إضافة</button>
                  </div>
                  {colors.length === 0 ? (
                    <div className="product-option-empty">بدون ألوان — المنتج يعمل بالمقاسات فقط.</div>
                  ) : (
                    <div className="product-option-list">
                      {colors.map((color, index) => (
                        <div className="product-option-row product-option-row--color" key={color.id}>
                          <span className="product-option-row__index">{String(index + 1).padStart(2, "0")}</span>
                          <ColorSwatchField hex={color.hex} label={`لون ${index + 1}`} onChange={(hex) => updateColor(color.id, hex)} />
                          <button type="button" className="variant-row__remove" onClick={() => removeColor(color.id)} aria-label="حذف اللون"><Icon.Trash /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="variant-matrix">
                <div className="variant-matrix__head">
                  <div>
                    <strong>مصفوفة التركيبات</strong>
                    <span>{sizes.length} مقاس × {Math.max(colors.length, 1)} {colors.length ? "لون" : "خيار"}</span>
                  </div>
                  <span className="variant-matrix__count">{variants.length} تركيبة قابلة للبيع</span>
                </div>
                <div className="variant-rows">
                  {variants.map((v) => {
                    const size = sizes.find((option) => option.id === v.sizeId);
                    const color = colors.find((option) => option.id === v.colorId);
                    return (
                  <div className="variant-row variant-row--matrix" key={v.id}>
                    <div className="variant-combination">
                      <strong>{size?.label || "مقاس غير مسمى"}</strong>
                      {color ? <span className="variant-color"><i style={{ backgroundColor: color.hex }} /> <code dir="ltr">{color.hex}</code></span> : <span className="variant-color variant-color--empty">بدون لون</span>}
                    </div>
                    <div className="field">
                      <label htmlFor={`variant-price-${v.id}`}>السعر</label>
                      <input id={`variant-price-${v.id}`} className="input" type="number" min="0" value={v.price} onChange={(e) => updateVariant(v.id, { price: Number(e.target.value) })} />
                    </div>
                    <div className="field">
                      <label htmlFor={`variant-stock-${v.id}`}>المخزون</label>
                      <input id={`variant-stock-${v.id}`} className="input" type="number" min="0" value={v.stock} onChange={(e) => updateVariant(v.id, { stock: Number(e.target.value) })} />
                    </div>
                  </div>
                    );
                  })}
                </div>
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
                <label htmlFor="product-category">القسم</label>
                <CategoryPicker id="product-category" categories={categories} value={categoryId} onChange={setCategoryId} />
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
            uploadSlot={<ProductHoverImageUpload value={hoverImagePath} onChange={setHoverImagePath} uploadContext={mode === "edit" ? "products.update" : "products.create"} />}
          />
        </aside>
      </div>

    </div>
  );
}
