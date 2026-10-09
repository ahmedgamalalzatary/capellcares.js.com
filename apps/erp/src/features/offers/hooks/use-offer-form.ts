"use client";

import { useBundleForm } from "@/features/bundles/hooks/use-bundle-form";
import { offerConfig } from "@/features/offers/offer-config";
import type { OfferFormProps, UseOfferFormResult } from "@/features/offers/types";

export function useOfferForm(props: OfferFormProps): UseOfferFormResult {
  return useBundleForm(offerConfig, props);
}
