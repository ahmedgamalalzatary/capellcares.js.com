import type { Offer } from "@capella/shared";
import type { BundleFormProps, BundleFormRow, BundleRequirement, UseBundleFormResult } from "@/features/bundles/types";

export type OfferFormProps = BundleFormProps<Offer>;
export type OfferFormRow = BundleFormRow;
export type OfferRequirement = BundleRequirement;
export type UseOfferFormResult = UseBundleFormResult;
