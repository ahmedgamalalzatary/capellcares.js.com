"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/providers/cart-provider";
import { useAuth } from "@/components/providers/auth-provider";
import {
  pickLang, formatPrice,
  GOVERNORATES, EG_PHONE_REGEX, PAYMENT_METHODS,
  type Language, type PaymentMethod, type Product, type Offer
} from "@capella/shared";
import { fetchProducts, fetchOffers } from "@/lib/api/client";
import { Icon } from "@/components/ui/icons";
import styles from "./checkout.module.css";

interface Resolved { key: string; title: string; meta: string; unit: number; qty: number; }

interface Errors { [k: string]: string | undefined }

export function CheckoutView({ lang, dict }: { lang: Language; dict: any }) {
  const { lines, clear } = useCart();
  const { user, accessToken } = useAuth();
  const router = useRouter();

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
    Promise.all([fetchProducts({ lang }), fetchOffers(lang)]).then(([p, o]) => {
      setProducts(p);
      setOffers(o);
    }).catch(() => {});
  }, [lang]);

  const resolved: Resolved[] = useMemo(() => {
    return lines.map((l) => {
      if (l.type === "product") {
        const p = products.find((p) => p.id === l.productId);
        const v = p?.variants.find((v) => v.id === l.variantId);
        if (!p || !v) return null;
        return { key: `p${l.productId}${l.variantId}`, title: pickLang(p.name, lang), meta: v.size, unit: v.price, qty: l.qty };
      }
      const o = offers.find((o) => o.id === l.offerId);
      if (!o) return null;
      return { key: `o${l.offerId}`, title: pickLang(o.name, lang), meta: dict.offers.badge, unit: o.price, qty: l.qty };
    }).filter(Boolean) as Resolved[];
  }, [lines, lang, dict, products, offers]);

  const subtotal = resolved.reduce((acc, r) => acc + r.unit * r.qty, 0);

  const set = (k: keyof typeof form, v: any) => setForm((s) => ({ ...s, [k]: v }));

  const validate = (): boolean => {
    const e: Errors = {};
    if (!form.fullName.trim()) e.fullName = dict.checkout.required;
    if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) e.email = dict.checkout.required;
    if (!form.phone.trim() || !EG_PHONE_REGEX.test(form.phone.trim())) e.phone = dict.checkout.egPhoneInvalid;
    if (!form.governorate) e.governorate = dict.checkout.required;
    if (!form.cityArea.trim()) e.city = dict.checkout.required;
    if (!form.addressLine.trim()) e.addressLine = dict.checkout.required;
    if (!form.buildingApartment.trim()) e.building = dict.checkout.required;
    setErrors(e);
    return Object.keys(e).length === 0;
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
        items: lines.map((l) =>
          l.type === "product"
            ? { type: "product", variantId: l.variantId, qty: l.qty }
            : { type: "offer", offerId: l.offerId, qty: l.qty }
        )
      };
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/checkout`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Checkout failed");
      const data = await res.json();
      setOrderId(`CPL-${String(data.id)}`);
      clear();
    } finally {
      setPlacing(false);
    }
  };

  if (orderId) {
    return (
      <div className={styles.confirm}>
        <div className={styles.confirmIcon}><Icon.Check size={32} /></div>
        <h2 className="display" style={{ fontSize: 28, margin: 0 }}>{dict.common.orderPlaced}</h2>
        <p className="muted">{dict.common.orderPlacedDesc}</p>
        <div className={styles.orderNo}>{orderId}</div>
        <Link href={`/${lang}/products`} className="btn btn--primary">{dict.cart.keepShopping}</Link>
      </div>
    );
  }

  if (resolved.length === 0) {
    return (
      <div className={styles.confirm}>
        <p className="muted">{dict.cart.empty}</p>
        <Link href={`/${lang}/products`} className="btn btn--primary">{dict.cart.keepShopping}</Link>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <form
        className={styles.form}
        onSubmit={(e) => { e.preventDefault(); placeOrder(); }}
        noValidate
      >
        <Section title={dict.checkout.contact}>
          <div className={styles.grid2}>
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
          <div className={styles.grid2}>
            <Field label={dict.checkout.governorate} error={errors.governorate}>
              <select className="select" value={form.governorate} onChange={(e) => set("governorate", e.target.value)}>
                <option value="">—</option>
                {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
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
          <div className={styles.payments}>
            <label className={styles.payOption} data-active={form.paymentMethod === "cod"}>
              <input type="radio" name="pay" value="cod" checked={form.paymentMethod === "cod"} onChange={() => set("paymentMethod", "cod")} />
              <div>
                <div style={{ fontWeight: 600 }}>{dict.checkout.cod}</div>
                <div className="muted" style={{ fontSize: 13 }}>{dict.checkout.codDesc}</div>
              </div>
            </label>
          </div>
        </Section>

        <button type="submit" className="btn btn--primary btn--block" disabled={placing} style={{ height: 52 }}>
          {placing ? dict.common.loading : dict.checkout.placeOrder}
        </button>
      </form>

      <aside className={styles.summary}>
        <div className="display" style={{ fontSize: 20 }}>{dict.checkout.review}</div>
        <hr className="hr" />
        <ul className={styles.items}>
          {resolved.map((r) => (
            <li key={r.key} className={styles.item}>
              <div>
                <div style={{ fontWeight: 500 }}>{r.title}</div>
                <div className="muted" style={{ fontSize: 12 }}>{r.meta} · {dict.common.quantity}: {r.qty}</div>
              </div>
              <div>{formatPrice(r.unit * r.qty, lang)}</div>
            </li>
          ))}
        </ul>
        <hr className="hr" />
        <div className={styles.row}><span className="muted">{dict.common.subtotal}</span><span>{formatPrice(subtotal, lang)}</span></div>
        <div className={styles.row}><span className="muted">{dict.common.shipping}</span><span className="muted" style={{ fontSize: 12 }}>{dict.common.calculatedAtCheckout}</span></div>
        <div className={styles.row} style={{ fontSize: 18, fontWeight: 600, paddingTop: 8 }}>
          <span>{dict.common.total}</span>
          <span className="display">{formatPrice(subtotal, lang)}</span>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, error, fullWidth, children }: { label: string; error?: string; fullWidth?: boolean; children: React.ReactNode }) {
  return (
    <div className="field" style={{ gridColumn: fullWidth ? "1 / -1" : undefined }}>
      <label>{label}</label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
