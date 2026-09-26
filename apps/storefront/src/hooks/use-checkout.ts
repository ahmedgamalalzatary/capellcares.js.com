"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  EG_PHONE_REGEX,
  PAYMENT_METHODS,
  type CheckoutRequestDto,
  type Collection,
  type CheckoutShippingAvailability,
  type CheckoutShippingQuote,
  getEffectiveVariantPrice,
  pickLang
} from "@capella/shared";
import { useAuth } from "@/components/providers/auth-provider";
import { useCart } from "@/components/providers/cart-provider";
import { fetchCollections, fetchOffers, fetchPaymobMethods, fetchProducts, submitCheckout, fetchCheckoutShipping, fetchCheckoutShippingQuote } from "@/lib/api/client";
import { cartLineSizeLabel } from "@/lib/cart-line-size";
import { clearPendingCheckout, getCheckoutIdempotencyKey, redirectToPaymob, rememberPendingCheckout } from "@/lib/paymob-browser-session";
import type {
  CheckoutCatalogState,
  CheckoutErrors,
  CheckoutFormState,
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
    governorate: "",
    cityArea: "",
    addressLine: "",
    buildingApartment: "",
    notes: "",
    paymentMethod: PAYMENT_METHODS.cod,
    shippingCityId: "", shippingZoneId: "", shippingDistrictId: ""
  });
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);
  const [paymobMethods, setPaymobMethods] = useState<Array<"card" | "wallet">>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<CheckoutShippingAvailability | null>(null);
  const [shippingLoading, setShippingLoading] = useState(true);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [shippingRetry, setShippingRetry] = useState(0);
  const [quoted, setQuoted] = useState<{ key: string; value: CheckoutShippingQuote } | null>(null);
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
    fetchPaymobMethods()
      .then(({ available, methods }) => setPaymobMethods(available ? methods : []))
      .catch(() => setPaymobMethods([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setShippingLoading(true);
    fetchCheckoutShipping().then(next => {
      if (cancelled) return;
      setAvailability(next); setShippingError(null); setShippingLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setAvailability(null); setShippingError(dict.checkout.shippingUnavailable); setShippingLoading(false);
    });
    return () => { cancelled = true; };
  }, [shippingRetry, dict.checkout.shippingUnavailable]);

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
            meta: cartLineSizeLabel(line, { products, offers, collections }) ?? variant.size,
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

  const subtotal = resolved.reduce((acc, item) => acc + item.unit * item.qty, 0);
  const items = lines.map((line) => line.type === "product"
    ? { type: "product" as const, variantId: line.variantId, qty: line.qty }
    : line.type === "offer" ? { type: "offer" as const, offerId: line.offerId, qty: line.qty }
      : { type: "collection" as const, collectionId: line.collectionId, qty: line.qty });
  const quoteKey = JSON.stringify([items, form.paymentMethod, form.shippingCityId, form.shippingZoneId,
    form.shippingDistrictId, user?.id ?? null, accessToken, Math.round(subtotal * 100)]);
  const shippingQuote = quoted?.key === quoteKey && availability?.enabled ? quoted.value : null;
  const totalAmount = subtotal + (shippingQuote?.shippingAmountCents ?? 0) / 100;

  useEffect(() => {
    let cancelled = false;
    setQuoted(null);
    if (!availability?.enabled || !form.shippingCityId || !form.shippingZoneId || !form.shippingDistrictId ||
      resolved.length !== lines.length || lines.length === 0) {
      if (availability) setShippingLoading(false);
      return;
    }
    setShippingLoading(true); setShippingError(null);
    fetchCheckoutShippingQuote({ items, paymentMethod: form.paymentMethod, shippingAddress: {
      cityId: form.shippingCityId, zoneId: form.shippingZoneId, districtId: form.shippingDistrictId
    } }, accessToken, user != null).then(value => {
      if (cancelled) return;
      if (value.productsTotalCents !== Math.round(subtotal * 100)) {
        setShippingError(dict.checkout.amountChanged);
      } else setQuoted({ key: quoteKey, value });
      setShippingLoading(false);
    }).catch(error => {
      if (cancelled) return;
      setShippingError((error as { code?: string })?.code === "SHIPPING_UNSUPPORTED"
        ? dict.checkout.shippingUnsupported : dict.checkout.shippingUnavailable);
      setShippingLoading(false);
    });
    return () => { cancelled = true; };
  // quoteKey binds the request to cart, selected destination, payment and customer.
  }, [quoteKey, availability, shippingRetry, dict.checkout.amountChanged, dict.checkout.shippingUnavailable]);

  const setField = <K extends keyof CheckoutFormState>(key: K, value: CheckoutFormState[K]) => {
    setForm((state) => {
      if (key === "shippingCityId") return { ...state, shippingCityId: String(value), shippingZoneId: "", shippingDistrictId: "",
        governorate: availability?.addresses.find(row => row.cityId === value)?.cityName.en ?? "", cityArea: "" };
      if (key === "shippingZoneId") return { ...state, shippingZoneId: String(value), shippingDistrictId: "", cityArea: "" };
      if (key === "shippingDistrictId") {
        const district = availability?.addresses.find(row => row.cityId === state.shippingCityId && row.zoneId === state.shippingZoneId && row.districtId === value);
        return { ...state, shippingDistrictId: String(value), cityArea: district ? `${district.zoneName.en} / ${district.districtName.en}` : "" };
      }
      return { ...state, [key]: value };
    });
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
    if (availability?.enabled && !shippingQuote) next.shipping = shippingError ?? dict.checkout.shippingPending;
    if (availability == null || shippingLoading) next.shipping = shippingError ?? dict.common.loading;
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
    placingRef.current = true;
    setPlacing(true);

    try {
      const payload: CheckoutRequestDto = {
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        governorate: form.governorate,
        cityArea: form.cityArea,
        addressLine: form.addressLine,
        buildingApartment: form.buildingApartment,
        notes: form.notes || undefined,
        paymentMethod: totalAmount === 0 && !availability?.enabled ? PAYMENT_METHODS.cod : form.paymentMethod,
        expectedAmountCents: Math.round(totalAmount * 100),
        ...(shippingQuote ? { shippingQuoteId: shippingQuote.quoteId, shippingAddress: {
          cityId: shippingQuote.address.cityId, zoneId: shippingQuote.address.zoneId, districtId: shippingQuote.address.districtId
        } } : {}),
        items
      };

      const data = await submitCheckout(payload, accessToken, {
        requireAuthentication: user != null,
        idempotencyKey: await getCheckoutIdempotencyKey(payload)
      });
      if (!data) throw new Error("Checkout failed");
      if (data.kind === "paymob_redirect") {
        rememberPendingCheckout(data.checkoutId, lang);
        redirectToPaymob(data.checkoutUrl);
      } else {
        setOrderId(data.orderCode);
        clear();
        clearPendingCheckout();
      }
    } catch (error) {
      const code = (error as { code?: string })?.code;
      const message = code === "SHIPPING_QUOTE_CHANGED" ? dict.checkout.shippingChanged
        : code === "CHECKOUT_AMOUNT_CHANGED" ? dict.checkout.amountChanged
          : code === "SHIPPING_UNSUPPORTED" ? dict.checkout.shippingUnsupported
            : code === "SHIPPING_UNAVAILABLE" ? dict.checkout.shippingUnavailable
              : code === "PAYMENT_UNAVAILABLE" ? dict.checkout.paymentUnavailable
              : error instanceof Error && error.message ? error.message : dict.checkout.checkoutFailed;
      setErrors((state) => ({
        ...state,
        submit: message
      }));
      if (code === "SHIPPING_QUOTE_CHANGED" || code === "CHECKOUT_AMOUNT_CHANGED") {
        setQuoted(null); setShippingRetry(value => value + 1);
      }
    } finally {
      placingRef.current = false;
      setPlacing(false);
    }
  };

  return {
    shipping: { enabled: availability?.enabled ?? null, addresses: availability?.addresses ?? [], quote: shippingQuote,
      loading: shippingLoading, error: shippingError, retry: () => {
        setQuoted(null); setShippingRetry(value => value + 1);
        Promise.all([fetchProducts({ lang }), fetchOffers({ lang }), fetchCollections({ lang })])
          .then(([products, offers, collections]) => setCatalog({ products, offers, collections })).catch(() => {});
      } },
    totalAmount,
    form,
    errors,
    placing,
    paymobMethods,
    orderId,
    resolved,
    subtotal,
    setField,
    placeOrder
  };
}
