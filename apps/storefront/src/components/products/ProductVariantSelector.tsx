"use client";

import { useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { firstInStockVariant, resolveVariant, type StorefrontProduct, type StorefrontVariant } from "@/lib/products";

type Props = {
  product: StorefrontProduct;
  initialSizeId?: number;
  initialColorId?: number;
  initialVariantId?: number;
};

function initialVariant(product: StorefrontProduct, props: Omit<Props, "product">) {
  const byId = props.initialVariantId == null
    ? undefined
    : product.variants.find((variant) => variant.id === props.initialVariantId && variant.stock > 0);
  const byOptions = props.initialSizeId == null
    ? undefined
    : resolveVariant(product, props.initialSizeId, props.initialColorId ?? null);
  return byId ?? (byOptions?.stock ? byOptions : undefined) ?? firstInStockVariant(product);
}

export function ProductVariantSelector({ product, ...initial }: Props) {
  const { lang, dict } = useLocale();
  const [selected, setSelected] = useState<StorefrontVariant | undefined>(() => initialVariant(product, initial));
  const [added, setAdded] = useState(false);
  const name = product.name[lang];
  const labels = lang === "ar"
    ? { size: "المقاس", color: "اللون", stock: "متوفر", unavailable: "غير متوفر", added: "تمت الإضافة" }
    : { size: "Size", color: "Color", stock: "in stock", unavailable: "Unavailable", added: "Added" };

  const chooseColor = (colorId: number) => {
    const sameSize = selected && resolveVariant(product, selected.sizeId, colorId);
    setSelected(sameSize?.stock ? sameSize : product.variants.find((variant) => variant.colorId === colorId && variant.stock > 0));
    setAdded(false);
  };
  const chooseSize = (sizeId: number) => {
    const sameColor = resolveVariant(product, sizeId, selected?.colorId ?? null);
    setSelected(sameColor?.stock ? sameColor : product.variants.find((variant) => variant.sizeId === sizeId && variant.stock > 0));
    setAdded(false);
  };
  const addToCart = () => {
    if (!selected || selected.stock <= 0) return;
    const key = "minikoshk_cart";
    let cart: Array<{ variantId: number; qty: number }> = [];
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? "[]");
      if (Array.isArray(stored)) {
        cart = stored.filter((item): item is { variantId: number; qty: number } =>
          item != null && typeof item === "object" &&
          typeof item.variantId === "number" && Number.isInteger(item.variantId) && item.variantId > 0 &&
          typeof item.qty === "number" && Number.isInteger(item.qty) && item.qty > 0
        );
      }
    } catch {
      cart = [];
    }
    const existing = cart.find((item) => item.variantId === selected.id);
    if (existing) existing.qty += 1;
    else cart.push({ variantId: selected.id, qty: 1 });
    localStorage.setItem(key, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent("minikoshk:cart-updated", { detail: cart }));
    setAdded(true);
  };

  return (
    <section aria-label={name} className="mx-auto my-8 grid max-w-5xl gap-8 rounded-3xl bg-white p-6 shadow-xl md:grid-cols-2 md:p-10">
      <div className="flex min-h-80 items-center justify-center rounded-2xl bg-gray-50 p-8">
        <img src={product.imagePath} alt={name} className="max-h-96 w-full object-contain" />
      </div>
      <div className="flex flex-col justify-center">
        <h1 className="text-3xl font-extrabold uppercase tracking-wide text-brand-dark">{name}</h1>

        {product.colors.length > 0 && <fieldset className="mt-7">
          <legend className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">{labels.color}</legend>
          <div className="flex flex-wrap gap-3">{product.colors.map((color) => {
            const available = product.variants.some((variant) => variant.colorId === color.id && variant.stock > 0);
            const active = selected?.colorId === color.id;
            return <button key={color.id} type="button" aria-label={`Color ${color.hex}`} title={color.hex} disabled={!available}
              onClick={() => chooseColor(color.id)}
              className={`h-10 w-10 rounded-full border-2 transition ${active ? "border-brand-dark ring-2 ring-brand-dark/20" : "border-gray-300"} disabled:cursor-not-allowed disabled:opacity-30`}
              style={{ backgroundColor: color.hex }} />;
          })}</div>
        </fieldset>}

        <fieldset className="mt-7">
          <legend className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">{labels.size}</legend>
          <div className="flex flex-wrap gap-2">{product.sizes.map((size) => {
            const available = product.variants.some((variant) => variant.sizeId === size.id && variant.stock > 0);
            const active = selected?.sizeId === size.id;
            return <button key={size.id} type="button" disabled={!available} onClick={() => chooseSize(size.id)}
              className={`min-w-20 rounded-full border px-4 py-2 text-sm font-bold transition ${active ? "border-brand-dark bg-brand-dark text-white" : "border-gray-300 text-brand-dark"} disabled:cursor-not-allowed disabled:opacity-30`}>{size.label}</button>;
          })}</div>
        </fieldset>

        <div className="mt-8 flex items-end justify-between gap-4 border-t border-gray-200 pt-6">
          <div>
            <div className="text-2xl font-extrabold text-brand-dark">{selected ? `${selected.price} ${dict.product.currency}` : labels.unavailable}</div>
            {selected && <div className="mt-1 text-sm text-gray-500">{selected.stock} {labels.stock}</div>}
          </div>
          <button type="button" disabled={!selected} onClick={addToCart}
            className="rounded-full bg-brand-dark px-7 py-3 text-sm font-bold text-white transition hover:bg-black disabled:opacity-40">
            {added ? labels.added : dict.product.addToCart}
          </button>
        </div>
      </div>
    </section>
  );
}
