"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPendingCheckoutLang } from "@/lib/paymob-browser-session";

export default function PaymobReturnPage() {
  const router = useRouter();

  useEffect(() => {
    const lang = getPendingCheckoutLang() ?? "ar";
    router.replace(`/${lang}/checkout/payment-result`);
  }, [router]);

  return null;
}
