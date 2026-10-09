import { BundleForm } from "@/features/bundles/components/bundle-form";
import { offerConfig } from "@/features/offers/offer-config";
import type { OfferFormProps } from "@/features/offers/types";

/** Offer editor: the shared bundle form with the offer config. */
export function OfferForm(props: OfferFormProps) {
  return <BundleForm config={offerConfig} {...props} />;
}
