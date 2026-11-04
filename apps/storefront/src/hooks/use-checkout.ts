"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  KW_PHONE_REGEX,
  PAYMENT_METHODS,
  type CheckoutDeliveryGovernorate,
  type CheckoutQuoteDto,
  type CheckoutRequestDto,
  type Collection,
  getEffectiveVariantPrice,
  pickLang
} from "@capella/shared";
import { useAuth } from "@/components/providers/auth-provider";
import { useCart } from "@/components/providers/cart-provider";
import { fetchCollections, fetchDeliveryGovernorates, fetchOffers, fetchProducts, quoteCheckout, submitCheckout } from "@/lib/api/client";
import { cartLineSizeLabel, productLineOptions } from "@/lib/cart-line-size";
import { clearCheckoutRequest, getCheckoutIdempotencyKey } from "@/lib/checkout-request";
import type {
  CheckoutCatalogState,
  CheckoutErrors,
  CheckoutFormState,
  CheckoutQuoteState,
  CheckoutResolvedItem,
  CheckoutViewProps,
  UseCheckoutResult
} from "../types/checkout-view.types";

export function useCheckout({ lang, dict }: CheckoutViewProps): UseCheckoutResult {
  const { lines, clear } = useCart();
  const { user, accessToken } = useAuth();

  const [form, setForm] = useState<CheckoutFormState>({
    fullName: user?.name ?? "",
    phone: "",
    email: user?.email ?? "",
    governorateId: "",
    areaId: "",
    addressLine: "",
    buildingApartment: "",
    notes: ""
  });
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [governorates, setGovernorates] = useState<CheckoutDeliveryGovernorate[] | null>(null);
  const [quote, setQuote] = useState<CheckoutQuoteDto | null>(null);
  const [quoteState, setQuoteState] = useState<CheckoutQuoteState>("idle");
  const [{ products, offers, collections }, setCatalog] = useState<CheckoutCatalogState & { collections: Collection[] }>({
    products: [],
    offers: [],
    collections: []
  });

  useEffect(() => {
    setForm((state) => ({
      ...state,
      fullName: user?.name ?? "",
      email: user?.email ?? ""
    }));
  }, [user?.email, user?.name]);

  useEffect(() => {
    Promise.all([fetchProducts({ lang }), fetchOffers({ lang }), fetchCollections({ lang })])
      .then(([nextProducts, nextOffers, nextCollections]) => {
        setCatalog({ products: nextProducts, offers: nextOffers, collections: nextCollections });
      })
      .catch(() => { });
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    fetchDeliveryGovernorates()
      .then((list) => { if (!cancelled) setGovernorates(list); })
      // Unreachable is shown like "nothing set up": checkout cannot price delivery either way.
      .catch(() => { if (!cancelled) setGovernorates([]); });
    return () => { cancelled = true; };
  }, []);

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
            meta: (() => {
              const options = productLineOptions(product, variant, lang);
              return [options.size, options.color].filter(Boolean).join(" / ");
            })(),
            unit: getEffectiveVariantPrice(variant),
            qty: line.qty
          };
        }

        if (line.type === "offer") {
          const offer = offers.find((item) => item.id === line.offerId);
          if (!offer) return null;
          return {
            key: `o${line.offerId}`,
            title: pickLang(offer.name, lang),
            meta: cartLineSizeLabel(line, { products, offers, collections }) ?? dict.offers.badge,
            unit: offer.price,
            qty: line.qty
          };
        }

        const collection = collections.find((item) => item.id === line.collectionId);
        if (!collection) return null;
        return {
          key: `c${line.collectionId}`,
          title: pickLang(collection.name, lang),
          meta: cartLineSizeLabel(line, { products, offers, collections }) ?? dict.collections.badge,
          unit: collection.price,
          qty: line.qty
        };
      })
      .filter(Boolean) as CheckoutResolvedItem[];
  }, [collections, dict.collections.badge, dict.offers.badge, lang, lines, offers, products]);

  // Summed in fils so 3-decimal prices never drift (0.1 + 0.2).
  const subtotal = resolved.reduce((acc, item) => acc + Math.round(item.unit * 1000) * item.qty, 0) / 1000;
  const items = useMemo(() => lines.map((line) => line.type === "product"
    ? { type: "product" as const, variantId: line.variantId, qty: line.qty }
    : line.type === "offer" ? { type: "offer" as const, offerId: line.offerId, qty: line.qty }
      : { type: "collection" as const, collectionId: line.collectionId, qty: line.qty }), [lines]);
  const areaId = Number(form.areaId) || null;

  // The server prices delivery (area fee + products' own fees); re-ask whenever the area or the cart changes.
  useEffect(() => {
    if (!areaId || items.length === 0) {
      setQuote(null);
      setQuoteState("idle");
      return;
    }
    let cancelled = false;
    setQuoteState("loading");
    quoteCheckout({ areaId, items })
      .then((next) => {
        if (cancelled) return;
        setQuote(next);
        setQuoteState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setQuote(null);
        setQuoteState("error");
      });
    return () => { cancelled = true; };
  }, [areaId, items]);

  const setField = <K extends keyof CheckoutFormState>(key: K, value: CheckoutFormState[K]) => {
    setForm((state) => ({ ...state, [key]: value }));
  };

  const validate = () => {
    const next: CheckoutErrors = {};
    if (!form.fullName.trim()) next.fullName = dict.checkout.required;
    if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) next.email = dict.checkout.required;
    if (!form.phone.trim() || !KW_PHONE_REGEX.test(form.phone.trim())) next.phone = dict.checkout.kwPhoneInvalid;
    if (!form.governorateId) next.governorateId = dict.checkout.required;
    if (!areaId) next.areaId = dict.checkout.required;
    if (!form.addressLine.trim()) next.addressLine = dict.checkout.required;
    if (!form.buildingApartment.trim()) next.building = dict.checkout.required;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const placeOrder = async () => {
    if (placingRef.current) return;
    if (!validate()) return;
    if (resolved.length !== lines.length) {
      setErrors((state) => ({ ...state, submit: dict.orders.unavailableItem }));
      return;
    }
    // Never order without showing the delivery fee first.
    if (!quote || quoteState !== "ready") {
      setErrors((state) => ({ ...state, submit: dict.checkout.deliveryQuoteFailed }));
      return;
    }
    placingRef.current = true;
    setPlacing(true);

    try {
      const payload: CheckoutRequestDto = {
        fullName: form.fullName,
        phone: form.phone.trim(),
        email: form.email,
        areaId: areaId!,
        addressLine: form.addressLine,
        buildingApartment: form.buildingApartment,
        notes: form.notes || undefined,
        paymentMethod: PAYMENT_METHODS.cod,
        expectedAmountFils: Math.round(quote.total * 1000),
        items
      };

      const data = await submitCheckout(payload, accessToken, {
        requireAuthentication: user != null,
        idempotencyKey: await getCheckoutIdempotencyKey(payload)
      });
      if (!data) throw new Error("Checkout failed");
      setOrderId(data.orderCode);
      clear();
      clearCheckoutRequest();
    } catch (error) {
      const code = (error as { code?: string })?.code;
      const message = code === "CHECKOUT_AMOUNT_CHANGED" ? dict.checkout.amountChanged
        : error instanceof Error && error.message ? error.message : dict.checkout.checkoutFailed;
      setErrors((state) => ({ ...state, submit: message }));
    } finally {
      placingRef.current = false;
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
    governorates,
    quote,
    quoteState,
    setField,
    placeOrder
  };
}
