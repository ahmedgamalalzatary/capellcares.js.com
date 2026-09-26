import type { Language, Offer, PaymentMethod, Product, ShippingDestination, CheckoutShippingQuote } from "@capella/shared";

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

export interface CheckoutSummaryProps extends CheckoutViewProps {
  shippingAmountCents?: number | null;
  resolved: CheckoutResolvedItem[];
  subtotal: number;
}

export interface UseCheckoutResult {
  shipping: CheckoutShippingState;
  totalAmount: number;
  form: CheckoutFormState;
  errors: CheckoutErrors;
  placing: boolean;
  paymobMethods: Array<"card" | "wallet">;
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
