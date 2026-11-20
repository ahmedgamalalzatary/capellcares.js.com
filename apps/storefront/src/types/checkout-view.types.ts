import type { CheckoutDeliveryGovernorate, CheckoutPriceResponseDto, CheckoutQuoteDto, Language, Offer, Product, PromoAppliedDto } from "@capella/shared";

export interface CheckoutViewProps {
  lang: Language;
  dict: any;
}

export interface CheckoutResolvedItem {
  key: string;
  title: string;
  meta: string;
  unit: number;
  qty: number;
  /** Position of the line in the cart, matching the server's priced items. */
  index: number;
  /** What the customer pays for the line with a code applied, from the server; absent without a code. */
  lineTotal?: number;
}

export interface CheckoutErrors {
  [key: string]: string | undefined;
}

export interface CheckoutFormState {
  fullName: string;
  phone: string;
  email: string;
  /** Select values (ids as text); empty until chosen. */
  governorateId: string;
  areaId: string;
  addressLine: string;
  buildingApartment: string;
  notes: string;
}

export interface CheckoutFormProps extends CheckoutViewProps {
  form: CheckoutFormState;
  errors: CheckoutErrors;
  placing: boolean;
  /** null while loading. */
  governorates: CheckoutDeliveryGovernorate[] | null;
  setField: <K extends keyof CheckoutFormState>(key: K, value: CheckoutFormState[K]) => void;
  placeOrder: () => Promise<void>;
}

/** idle = no area chosen yet. */
export type CheckoutQuoteState = "idle" | "loading" | "ready" | "error";

export interface CheckoutPromoState {
  savedCode: string;
  saveCode: (code: string | null, acceptedSales?: string) => void;
  signedIn: boolean;
  loginHref: string;
  result: CheckoutPriceResponseDto["promo"];
  /** The code as applied to the totals: set only when it applies and the customer accepted what it does. */
  applied: PromoAppliedDto | null;
  /** The code replaces sales the customer has not confirmed yet; checkout waits for an answer. */
  confirmation: PromoAppliedDto | null;
  confirm: () => void;
  decline: () => void;
  preview: (code: string) => Promise<CheckoutPriceResponseDto | null>;
  /** Products total after the code (equals the subtotal without one). */
  productsTotal: number;
  /** Why a saved code was just removed at checkout. */
  notice: string | null;
}

export interface CheckoutSummaryProps extends CheckoutViewProps {
  resolved: CheckoutResolvedItem[];
  subtotal: number;
  quote: CheckoutQuoteDto | null;
  quoteState: CheckoutQuoteState;
  promo?: CheckoutPromoState;
}

export interface UseCheckoutResult {
  form: CheckoutFormState;
  errors: CheckoutErrors;
  placing: boolean;
  orderId: string | null;
  /** The code the order was placed with, for the confirmation; null without one. */
  placedPromo: PromoAppliedDto | null;
  resolved: CheckoutResolvedItem[];
  subtotal: number;
  governorates: CheckoutDeliveryGovernorate[] | null;
  quote: CheckoutQuoteDto | null;
  quoteState: CheckoutQuoteState;
  promo: CheckoutPromoState;
  setField: <K extends keyof CheckoutFormState>(key: K, value: CheckoutFormState[K]) => void;
  placeOrder: () => Promise<void>;
}

export interface CheckoutCatalogState {
  products: Product[];
  offers: Offer[];
}
