"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { CartLine, CheckoutPriceResponseDto, CheckoutRequestDto, Language } from "@capella/shared";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchCheckoutPrice } from "@/lib/api/client";
import { authHref } from "@/lib/auth-redirect";
import { usePromoCode } from "@/lib/promo/promo-code";

export function toCheckoutItems(lines: CartLine[]): CheckoutRequestDto["items"] {
  return lines.map((line) => line.type === "product"
    ? { type: "product" as const, variantId: line.variantId, qty: line.qty }
    : line.type === "offer" ? { type: "offer" as const, offerId: line.offerId, qty: line.qty }
      : { type: "collection" as const, collectionId: line.collectionId, qty: line.qty });
}

/** The saved promo code and the cart as the server prices it with that code, shared by cart and checkout. */
export function useCartPromo(lang: Language, lines: CartLine[]) {
  const { user, accessToken } = useAuth();
  const pathname = usePathname();
  const [savedCode, saveCode] = usePromoCode();
  const items = useMemo(() => toCheckoutItems(lines), [lines]);
  // Codes are for signed-in customers only; a guest's code stays saved until they log in.
  const activeCode = user ? savedCode : "";
  const key = JSON.stringify([items, activeCode, accessToken]);
  const [state, setState] = useState<{ key: string; priced: CheckoutPriceResponseDto | null } | null>(null);

  useEffect(() => {
    if (!activeCode || items.length === 0) return;
    let cancelled = false;
    fetchCheckoutPrice({ items, promoCode: activeCode }, accessToken)
      .then((priced) => { if (!cancelled) setState({ key, priced }); })
      .catch(() => { if (!cancelled) setState({ key, priced: null }); });
    return () => { cancelled = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- key captures items, code and token

  const priced = activeCode && state?.key === key ? state.priced : null;
  const applied = priced?.promo?.status === "applied" ? priced : null;
  return {
    items,
    savedCode,
    saveCode,
    signedIn: Boolean(user),
    loginHref: authHref("login", lang, pathname),
    priced,
    /** Set only when the saved code applies to this cart: its server totals are the ones to show and submit. */
    applied,
    loading: Boolean(activeCode) && items.length > 0 && state?.key !== key,
    preview: (code: string) => fetchCheckoutPrice({ items, promoCode: code }, accessToken)
  };
}
