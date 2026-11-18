import type { CheckoutPriceResponseDto, Language, Offer, PaymentMethod, Product, ShippingDestination, CheckoutShippingQuote } from "@capella/shared";

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
  saveCode: (code: string | null) => void;
  signedIn: boolean;
  loginHref: string;
  result: CheckoutPriceResponseDto["promo"];
  preview: (code: string) => Promise<CheckoutPriceResponseDto | null>;
  /** Products total after the code (equals the subtotal without one). */
  productsTotal: number;
  /** Why a saved code was just removed at checkout. */
  notice: string | null;
  /** The customer could pay online, but not with a promo code yet. */
  codOnly: boolean;
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
  resolved: CheckoutResolvedItem[];
  subtotal: number;
  setField: <K extends keyof CheckoutFormState>(key: K, value: CheckoutFormState[K]) => void;
  placeOrder: () => Promise<void>;
}

export interface CheckoutCatalogState {
  products: Product[];
  offers: Offer[];
}
