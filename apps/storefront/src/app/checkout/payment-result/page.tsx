"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPendingCheckoutLang } from "@/lib/paymob-browser-session";

export default function PaymobReturnPage() {
  const router = useRouter();

  useEffect(() => {
    const lang = getPendingCheckoutLang() ?? "ar";
    const checkoutId = new URLSearchParams(window.location.search).get("checkoutId");
    const query = checkoutId ? `?checkoutId=${encodeURIComponent(checkoutId)}` : "";
    router.replace(`/${lang}/checkout/payment-result${query}`);
  }, [router]);

  return null;
}
