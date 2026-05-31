"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EG_PHONE_REGEX,
  PAYMENT_METHODS,
  pickLang
} from "@capella/shared";
import { useAuth } from "@/components/providers/auth-provider";
import { useCart } from "@/components/providers/cart-provider";
import { fetchOffers, fetchProducts } from "@/lib/api/client";
import type {
  CheckoutCatalogState,
  CheckoutErrors,
  CheckoutFormState,
  CheckoutResolvedItem,
  CheckoutViewProps,
  UseCheckoutResult
} from "./checkout-view.types";

export function useCheckout({ lang, dict }: CheckoutViewProps): UseCheckoutResult {
  const { lines, clear } = useCart();
  const { user, accessToken } = useAuth();

  const [form, setForm] = useState<CheckoutFormState>({
    fullName: user?.name ?? "",
    phone: "",
    email: user?.email ?? "",
    governorate: "",
    cityArea: "",
    addressLine: "",
    buildingApartment: "",
    notes: "",
    paymentMethod: PAYMENT_METHODS.cod
  });
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [{ products, offers }, setCatalog] = useState<CheckoutCatalogState>({ products: [], offers: [] });

  useEffect(() => {
    setForm((state) => ({
      ...state,
      fullName: user?.name ?? "",
      email: user?.email ?? ""
    }));
  }, [user?.email, user?.name]);

  useEffect(() => {
    Promise.all([fetchProducts({ lang }), fetchOffers({ lang })])
      .then(([nextProducts, nextOffers]) => {
        setCatalog({ products: nextProducts, offers: nextOffers });
      })
      .catch(() => {});
  }, [lang]);

  const resolved = useMemo<CheckoutResolvedItem[]>(() => {
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
      .filter(Boolean) as CheckoutResolvedItem[];
  }, [dict.offers.badge, lang, lines, offers, products]);

  const subtotal = resolved.reduce((acc, item) => acc + item.unit * item.qty, 0);

  const setField = <K extends keyof CheckoutFormState>(key: K, value: CheckoutFormState[K]) => {
    setForm((state) => ({ ...state, [key]: value }));
  };

  const validate = () => {
    const next: CheckoutErrors = {};
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
        paymentMethod: form.paymentMethod,
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
    } catch (error) {
      setErrors((state) => ({
        ...state,
        submit: error instanceof Error && error.message ? error.message : "Checkout failed"
      }));
    } finally {
      setPlacing(false);
    }
  };

  return {
    form,
    errors,
    placing,
    orderId,
    resolved,
    subtotal,
    setField,
    placeOrder
  };
}
