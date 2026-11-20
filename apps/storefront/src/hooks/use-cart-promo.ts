"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { KW_PHONE_REGEX, type CartLine, type CheckoutPriceResponseDto, type CheckoutRequestDto, type Language, type PromoAppliedDto } from "@capella/shared";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchCheckoutPrice } from "@/lib/api/client";
import { authHref } from "@/lib/auth-redirect";
import { salesSignature, usePromoCode } from "@/lib/promo/promo-code";

export function toCheckoutItems(lines: CartLine[]): CheckoutRequestDto["items"] {
  return lines.map((line) => line.type === "product"
    ? { type: "product" as const, variantId: line.variantId, qty: line.qty }
    : line.type === "offer" ? { type: "offer" as const, offerId: line.offerId, qty: line.qty }
      : { type: "collection" as const, collectionId: line.collectionId, qty: line.qty });
}

/** The saved promo code and the cart as the server prices it with that code, shared by cart and checkout.
 * `phone` is the checkout phone: once valid, the code is checked against it too (first-order and per-customer rules). */
export function useCartPromo(lang: Language, lines: CartLine[], phone?: string) {
  const { user, accessToken } = useAuth();
  const pathname = usePathname();
  const promoCode = usePromoCode();
  const savedCode = promoCode.code;
  const items = useMemo(() => toCheckoutItems(lines), [lines]);
  // Codes are for signed-in customers only; a guest's code stays saved until they log in.
  const activeCode = user ? savedCode : "";
  const checkoutPhone = phone && KW_PHONE_REGEX.test(phone.trim()) ? phone.trim() : undefined;
  const [version, setVersion] = useState(0);
  const key = JSON.stringify([items, activeCode, accessToken, checkoutPhone ?? null, version]);
  const [state, setState] = useState<{ key: string; priced: CheckoutPriceResponseDto | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (!activeCode || items.length === 0) return;
    let cancelled = false;
    fetchCheckoutPrice({ items, promoCode: activeCode, ...(checkoutPhone ? { phone: checkoutPhone } : {}) }, accessToken)
      .then((priced) => { if (!cancelled) setState({ key, priced, failed: false }); })
      .catch(() => { if (!cancelled) setState({ key, priced: null, failed: true }); });
    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- key captures items, code, token, phone and refreshes

  const priced = activeCode && state?.key === key ? state.priced : null;
  const result = priced?.promo?.status === "applied" ? priced.promo : null;
  // Any sale the code would replace needs the customer's yes for exactly these lines and prices, however the code got here
  // (typed, saved as a guest before logging in, or re-priced after a cart or price change).
  const unconfirmed = result && result.replacedSales.length > 0 && salesSignature(result.replacedSales) !== promoCode.accepted;
  const confirmation: PromoAppliedDto | null = unconfirmed ? result : null;
  return {
    items,
    savedCode,
    saveCode: (code: string | null, acceptedSales?: string) => promoCode.save(code, acceptedSales),
    signedIn: Boolean(user),
    loginHref: authHref("login", lang, pathname),
    priced,
    /** Set only when the saved code applies to this cart and the customer accepted what it does: its server totals are the ones to show and submit. */
    applied: result && !unconfirmed ? priced : null,
    /** The code applies but replaces sales the customer has not confirmed yet. */
    confirmation,
    confirm: () => { if (confirmation) promoCode.accept(salesSignature(confirmation.replacedSales)); },
    decline: () => promoCode.save(null),
    loading: Boolean(activeCode) && items.length > 0 && state?.key !== key,
    /** The saved code could not be priced: checkout must not go ahead as if there were no code. */
    failed: Boolean(activeCode) && state?.key === key && state.failed,
    /** Prices the saved code again (prices or stock may have changed). */
    refresh: () => setVersion((value) => value + 1),
    preview: (code: string) => fetchCheckoutPrice({ items, promoCode: code, ...(checkoutPhone ? { phone: checkoutPhone } : {}) }, accessToken)
  };
}
