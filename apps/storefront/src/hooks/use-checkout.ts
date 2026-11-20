"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  KW_PHONE_REGEX,
  PAYMENT_METHODS,
  type CheckoutDeliveryGovernorate,
  type CheckoutQuoteDto,
  type CheckoutRequestDto,
  type Collection,
  type PromoAppliedDto,
  type PromoRejectionDto,
  getEffectiveVariantPrice,
  pickLang
} from "@capella/shared";
import { useAuth } from "@/components/providers/auth-provider";
import { useCart } from "@/components/providers/cart-provider";
import { fetchCollections, fetchDeliveryGovernorates, fetchOffers, fetchProducts, quoteCheckout, submitCheckout } from "@/lib/api/client";
import { cartLineSizeLabel, productLineOptions } from "@/lib/cart-line-size";
import { clearCheckoutRequest, getCheckoutIdempotencyKey } from "@/lib/checkout-request";
import { fillTemplate, promoRejectionMessage } from "@/lib/promo/promo-code";
import { useCartPromo } from "./use-cart-promo";
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
  const cartPromo = useCartPromo(lang, lines, form.phone);
  const [promoNotice, setPromoNotice] = useState<string | null>(null);
  const checkoutPhone = KW_PHONE_REGEX.test(form.phone.trim()) ? form.phone.trim() : null;
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [placing, setPlacing] = useState(false);
  const placingRef = useRef(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [placedPromo, setPlacedPromo] = useState<PromoAppliedDto | null>(null);
  const [governorates, setGovernorates] = useState<CheckoutDeliveryGovernorate[] | null>(null);
  const [quote, setQuote] = useState<CheckoutQuoteDto | null>(null);
  const [quoteState, setQuoteState] = useState<CheckoutQuoteState>("idle");
  const [quoteRetry, setQuoteRetry] = useState(0);
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
      .map((line, index) => {
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
            qty: line.qty,
            index
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
            qty: line.qty,
            index
          };
        }

        const collection = collections.find((item) => item.id === line.collectionId);
        if (!collection) return null;
        return {
          key: `c${line.collectionId}`,
          title: pickLang(collection.name, lang),
          meta: cartLineSizeLabel(line, { products, offers, collections }) ?? dict.collections.badge,
          unit: collection.price,
          qty: line.qty,
          index
        };
      })
      .filter(Boolean) as CheckoutResolvedItem[];
  }, [collections, dict.collections.badge, dict.offers.badge, lang, lines, offers, products]);

  // Summed in fils so 3-decimal prices never drift (0.1 + 0.2).
  const subtotal = resolved.reduce((acc, item) => acc + Math.round(item.unit * 1000) * item.qty, 0) / 1000;
  const items = cartPromo.items;
  const areaId = Number(form.areaId) || null;
  // With a promo code applied the server prices the cart (spec section 5.1); its products total is what is shown and submitted.
  const promoApplied = cartPromo.applied;
  const appliedCode = promoApplied?.promo?.status === "applied" ? promoApplied.promo.code : null;
  const productsTotal = promoApplied ? promoApplied.productsTotal : subtotal;
  // Each line at what the customer pays for it with the code (partial pieces, fixed amounts and replaced sales included).
  const shownItems = useMemo(() => resolved.map((item) => {
    const paid = promoApplied?.items.find((line) => line.index === item.index);
    return paid ? { ...item, lineTotal: paid.lineTotal } : item;
  }), [resolved, promoApplied]);

  // A saved code that no longer applies is removed at checkout, with the reason (spec section 3.1).
  const removeRejectedCode = (promo: PromoRejectionDto) => {
    cartPromo.saveCode(null);
    setPromoNotice(fillTemplate(dict.promo.removedAtCheckout, { code: promo.code, reason: promoRejectionMessage(promo, dict, lang) }));
  };
  useEffect(() => {
    const promo = cartPromo.priced?.promo;
    if (promo?.status === "rejected") removeRejectedCode(promo);
  }, [cartPromo.priced]); // eslint-disable-line react-hooks/exhaustive-deps -- react to a new server answer only

  // The server prices delivery (area fee + products' own fees, or nothing with a free-delivery code) and the code itself;
  // re-ask whenever the area, the cart, the code or the checkout phone changes.
  const quotePromo = appliedCode ? { promoCode: cartPromo.savedCode, ...(checkoutPhone ? { phone: checkoutPhone } : {}) } : null;
  const quoteKey = JSON.stringify([areaId, items, quotePromo, accessToken, quoteRetry]);
  useEffect(() => {
    if (!areaId || items.length === 0) {
      setQuote(null);
      setQuoteState("idle");
      return;
    }
    if (cartPromo.loading) {
      setQuoteState("loading");
      return;
    }
    let cancelled = false;
    setQuoteState("loading");
    (quotePromo ? quoteCheckout({ areaId, items, ...quotePromo }, accessToken) : quoteCheckout({ areaId, items }))
      .then((next) => {
        if (cancelled) return;
        // The code stopped applying after it was priced: take it off and say why; the next quote prices the cart without it.
        if (next.promo?.status === "rejected") {
          removeRejectedCode(next.promo);
          return;
        }
        setQuote(next);
        setQuoteState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setQuote(null);
        setQuoteState("error");
      });
    return () => { cancelled = true; };
  }, [quoteKey, cartPromo.loading]); // eslint-disable-line react-hooks/exhaustive-deps -- quoteKey binds area, cart, code, phone and customer

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
    if (cartPromo.loading) next.submit = dict.common.loading;
    if (cartPromo.failed) next.submit = dict.promo.checkFailed;
    if (cartPromo.confirmation) next.submit = dict.promo.confirmNeeded;
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
        ...(appliedCode && promoApplied?.promo?.status === "applied" ? {
          promoCode: cartPromo.savedCode,
          // The sale replacements the customer confirmed, so the server never charges ones they have not seen.
          promoAcceptedSales: promoApplied.promo.replacedSales.filter((sale) => sale.item)
            .map((sale) => ({ item: sale.item!, previousLineTotal: sale.previousLineTotal, lineTotal: sale.lineTotal }))
        } : {}),
        items
      };

      const data = await submitCheckout(payload, accessToken, {
        requireAuthentication: user != null,
        idempotencyKey: await getCheckoutIdempotencyKey(payload)
      });
      if (!data) throw new Error("Checkout failed");
      setPlacedPromo(promoApplied?.promo?.status === "applied" ? promoApplied.promo : null);
      setOrderId(data.orderCode);
      clear();
      clearCheckoutRequest();
    } catch (error) {
      const code = (error as { code?: string })?.code;
      const rejected = code === "PROMO_REJECTED" ? (error as { body?: { promo?: PromoRejectionDto } }).body?.promo : undefined;
      if (code === "PROMO_REJECTED") cartPromo.saveCode(null);
      const message = rejected
        ? fillTemplate(dict.promo.removedAtCheckout, { code: rejected.code, reason: promoRejectionMessage(rejected, dict, lang) })
        : code === "PROMO_CONFIRMATION_REQUIRED" ? dict.promo.confirmNeeded
          : code === "CHECKOUT_AMOUNT_CHANGED" ? dict.checkout.amountChanged
            : error instanceof Error && error.message ? error.message : dict.checkout.checkoutFailed;
      setErrors((state) => ({ ...state, submit: message }));
      if (code === "CHECKOUT_AMOUNT_CHANGED" || code === "PROMO_REJECTED") setQuoteRetry((value) => value + 1);
      // Prices moved on the server: price the code again, which asks for a fresh confirmation when its sale replacements changed.
      if (appliedCode && (code === "PROMO_CONFIRMATION_REQUIRED" || code === "CHECKOUT_AMOUNT_CHANGED")) cartPromo.refresh();
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
    placedPromo,
    resolved: shownItems,
    subtotal,
    governorates,
    quote,
    quoteState,
    promo: {
      savedCode: cartPromo.savedCode,
      saveCode: (code: string | null, acceptedSales?: string) => { setPromoNotice(null); cartPromo.saveCode(code, acceptedSales); },
      signedIn: cartPromo.signedIn,
      loginHref: cartPromo.loginHref,
      result: cartPromo.priced?.promo ?? null,
      applied: promoApplied?.promo?.status === "applied" ? promoApplied.promo : null,
      confirmation: cartPromo.confirmation,
      confirm: cartPromo.confirm,
      decline: () => { setPromoNotice(null); cartPromo.decline(); },
      preview: cartPromo.preview,
      productsTotal,
      notice: promoNotice
    },
    setField,
    placeOrder
  };
}
