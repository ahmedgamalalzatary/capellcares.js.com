import type { CheckoutPriceResponseDto, Language, PromoAppliedDto, Offer, PaymentMethod, Product, ShippingDestination, CheckoutShippingQuote } from "@capella/shared";

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
  governorate: string;
  cityArea: string;
  addressLine: string;
  buildingApartment: string;
  notes: string;
  paymentMethod: PaymentMethod;
  shippingCityId?: string;
  shippingZoneId?: string;
  shippingDistrictId?: string;
}

export interface CheckoutShippingState {
  enabled: boolean | null;
  addresses: ShippingDestination[];
  quote: CheckoutShippingQuote | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export interface CheckoutFormProps extends CheckoutViewProps {
  shipping?: CheckoutShippingState;
  form: CheckoutFormState;
  errors: CheckoutErrors;
  placing: boolean;
  paymobMethods: Array<"card" | "wallet">;
  setField: <K extends keyof CheckoutFormState>(key: K, value: CheckoutFormState[K]) => void;
  placeOrder: () => Promise<void>;
}

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
  /** Online payment is hidden because the total is under Paymob's EGP 10 minimum. */
  onlineMinimum: boolean;
}

export interface CheckoutSummaryProps extends CheckoutViewProps {
  shippingAmountCents?: number | null;
  resolved: CheckoutResolvedItem[];
  subtotal: number;
  promo?: CheckoutPromoState;
}

export interface UseCheckoutResult {
  shipping: CheckoutShippingState;
  totalAmount: number;
  form: CheckoutFormState;
  errors: CheckoutErrors;
  placing: boolean;
  paymobMethods: Array<"card" | "wallet">;
  promo: CheckoutPromoState;
  orderId: string | null;
  /** The code the order was placed with, for the confirmation; null without one. */
  placedPromo: PromoAppliedDto | null;
  resolved: CheckoutResolvedItem[];
  subtotal: number;
  setField: <K extends keyof CheckoutFormState>(key: K, value: CheckoutFormState[K]) => void;
  placeOrder: () => Promise<void>;
}

export interface CheckoutCatalogState {
  products: Product[];
  offers: Offer[];
}
