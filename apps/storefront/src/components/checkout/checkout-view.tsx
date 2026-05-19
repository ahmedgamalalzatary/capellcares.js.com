"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useCart } from "@/components/providers/cart-provider";
import { useAuth } from "@/components/providers/auth-provider";
import {
  pickLang,
  formatPrice,
  GOVERNORATES,
  EG_PHONE_REGEX,
  PAYMENT_METHODS,
  type Language,
  type PaymentMethod,
  type Product,
  type Offer
} from "@capella/shared";
import { fetchProducts, fetchOffers } from "@/lib/api/client";
import { Icon } from "@/components/ui/icons";

interface Resolved {
  key: string;
  title: string;
  meta: string;
  unit: number;
  qty: number;
}

interface Errors {
  [k: string]: string | undefined;
}

export function CheckoutView({ lang, dict }: { lang: Language; dict: any }) {
  const { lines, clear } = useCart();
  const { user, accessToken } = useAuth();

  const [form, setForm] = useState({
    fullName: user?.name ?? "",
    phone: "",
    email: user?.email ?? "",
    governorate: "",
    cityArea: "",
    addressLine: "",
    buildingApartment: "",
    notes: "",
    paymentMethod: PAYMENT_METHODS.cod as PaymentMethod
  });
  const [errors, setErrors] = useState<Errors>({});
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    Promise.all([fetchProducts({ lang }), fetchOffers({ lang })])
      .then(([p, o]) => {
        setProducts(p);
        setOffers(o);
      })
      .catch(() => {});
  }, [lang]);

  const resolved: Resolved[] = useMemo(() => {
    return lines
      .map((line) => {
        if (line.type === "product") {
          const product = products.find((item) => item.id === line.productId);
          const variant = product?.variants.find((item) => item.id === line.variantId);
          if (!product || !variant) return null;
          return {
            key: `p${line.productId}${line.variantId}`,
            title: pickLang(product.name, lang),
            meta: variant.size,
            unit: variant.price,
            qty: line.qty
          };
        }

        const offer = offers.find((item) => item.id === line.offerId);
        if (!offer) return null;
        return {
          key: `o${line.offerId}`,
          title: pickLang(offer.name, lang),
          meta: dict.offers.badge,
          unit: offer.price,
          qty: line.qty
        };
      })
      .filter(Boolean) as Resolved[];
  }, [lines, lang, dict, products, offers]);

  const subtotal = resolved.reduce((acc, item) => acc + item.unit * item.qty, 0);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((state) => ({ ...state, [key]: value }));
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (!form.fullName.trim()) next.fullName = dict.checkout.required;
    if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) next.email = dict.checkout.required;
    if (!form.phone.trim() || !EG_PHONE_REGEX.test(form.phone.trim())) next.phone = dict.checkout.egPhoneInvalid;
    if (!form.governorate) next.governorate = dict.checkout.required;
    if (!form.cityArea.trim()) next.city = dict.checkout.required;
    if (!form.addressLine.trim()) next.addressLine = dict.checkout.required;
    if (!form.buildingApartment.trim()) next.building = dict.checkout.required;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const placeOrder = async () => {
    if (!validate()) return;
    setPlacing(true);

    try {
      const payload = {
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        governorate: form.governorate,
        cityArea: form.cityArea,
        addressLine: form.addressLine,
        buildingApartment: form.buildingApartment,
        notes: form.notes || undefined,
        paymentMethod: "cod",
        customerId: user?.id ?? null,
        items: lines.map((line) =>
          line.type === "product"
            ? { type: "product", variantId: line.variantId, qty: line.qty }
            : { type: "offer", offerId: line.offerId, qty: line.qty }
        )
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/checkout`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Checkout failed");
      const data = await response.json();
      setOrderId(String(data.orderCode));
      clear();
    } finally {
      setPlacing(false);
    }
  };

  if (orderId) {
    return (
      <div className="grid place-items-center gap-3 py-20 text-center">
        <div className="grid h-[84px] w-[84px] place-items-center rounded-full bg-(--accent-2) text-white">
          <Icon.Check size={32} />
        </div>
        <h2 className="m-0 text-[28px] font-(--font-display) leading-none">{dict.common.orderPlaced}</h2>
        <p className="text-(--ink-2)">{dict.common.orderPlacedDesc}</p>
        <div className="rounded-[12px] bg-(--bg-tint) px-6 py-3 text-[28px] font-(--font-display) tracking-[0.08em]">
          {orderId}
        </div>
        <Link href={`/${lang}/products`} className="btn btn--primary">
          {dict.cart.keepShopping}
        </Link>
      </div>
    );
  }

  if (resolved.length === 0) {
    return (
      <div className="grid place-items-center gap-3 py-20 text-center">
        <p className="text-(--ink-2)">{dict.cart.empty}</p>
        <Link href={`/${lang}/products`} className="btn btn--primary">
          {dict.cart.keepShopping}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-9 pb-20 lg:grid-cols-[1fr_380px] lg:items-start">
      <form
        className="grid gap-7"
        onSubmit={(e) => {
          e.preventDefault();
          placeOrder();
        }}
        noValidate
      >
        <Section title={dict.checkout.contact}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={dict.checkout.fullName} error={errors.fullName}>
              <input className="input" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
            </Field>
            <Field label={dict.checkout.email} error={errors.email}>
              <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label={dict.checkout.phone} error={errors.phone}>
              <input className="input" inputMode="tel" placeholder="01XXXXXXXXX" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title={dict.checkout.shipping}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={dict.checkout.governorate} error={errors.governorate}>
              <select className="select" value={form.governorate} onChange={(e) => set("governorate", e.target.value)}>
                <option value="">—</option>
                {GOVERNORATES.map((governorate) => (
                  <option key={governorate} value={governorate}>
                    {governorate}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={dict.checkout.city} error={errors.city}>
              <input className="input" value={form.cityArea} onChange={(e) => set("cityArea", e.target.value)} />
            </Field>
            <Field label={dict.checkout.addressLine} error={errors.addressLine} fullWidth>
              <input className="input" value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} />
            </Field>
            <Field label={dict.checkout.building} error={errors.building}>
              <input className="input" value={form.buildingApartment} onChange={(e) => set("buildingApartment", e.target.value)} />
            </Field>
            <Field label={dict.checkout.notes} fullWidth>
              <textarea className="textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} />
            </Field>
          </div>
        </Section>

        <Section title={dict.checkout.payment}>
          <div className="grid gap-2.5">
            <label
              className="grid cursor-pointer grid-cols-[20px_1fr] items-center gap-3.5 rounded-[12px] border border-(--hairline) bg-white px-4 py-3.5"
              data-active={form.paymentMethod === "cod"}
            >
              <input type="radio" name="pay" value="cod" checked={form.paymentMethod === "cod"} onChange={() => set("paymentMethod", "cod")} />
              <div>
                <div className="font-semibold">{dict.checkout.cod}</div>
                <div className="text-[13px] text-(--ink-2)">{dict.checkout.codDesc}</div>
              </div>
            </label>
          </div>
        </Section>

        <button type="submit" className="btn btn--primary btn--block h-[52px]" disabled={placing}>
          {placing ? dict.common.loading : dict.checkout.placeOrder}
        </button>
      </form>

      <aside className="sticky top-[140px] rounded-[16px] border border-(--hairline) bg-(--bg-elev) p-6">
        <div className="text-[20px] font-(--font-display)">{dict.checkout.review}</div>
        <hr className="hr" />
        <ul className="m-0 grid list-none gap-3 p-0">
          {resolved.map((item) => (
            <li key={item.key} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="text-[12px] text-(--ink-2)">
                  {item.meta} · {dict.common.quantity}: {item.qty}
                </div>
              </div>
              <div>{formatPrice(item.unit * item.qty, lang)}</div>
            </li>
          ))}
        </ul>
        <hr className="hr" />
        <div className="flex items-center justify-between py-1.5">
          <span className="text-(--ink-2)">{dict.common.subtotal}</span>
          <span>{formatPrice(subtotal, lang)}</span>
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-(--ink-2)">{dict.common.shipping}</span>
          <span className="text-[12px] text-(--ink-2)">{dict.common.calculatedAtCheckout}</span>
        </div>
        <div className="flex items-center justify-between pt-2 text-[18px] font-semibold">
          <span>{dict.common.total}</span>
          <span className="font-(--font-display)">{formatPrice(subtotal, lang)}</span>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-[16px] border border-(--hairline) bg-(--bg-elev) p-6">
      <h2 className="m-0 text-[22px] font-(--font-display)">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  fullWidth,
  children
}: {
  label: string;
  error?: string;
  fullWidth?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={fullWidth ? "grid gap-1.5 md:col-span-2" : "grid gap-1.5"}>
      <label className="text-sm font-medium text-(--ink-2)">{label}</label>
      {children}
      {error && <span className="text-[12px] text-(--danger)">{error}</span>}
    </div>
  );
}

