import type { CheckoutDeliveryGovernorate, CheckoutQuoteDto, Language, Offer, Product } from "@capella/shared";

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

export interface CheckoutSummaryProps extends CheckoutViewProps {
  resolved: CheckoutResolvedItem[];
  subtotal: number;
  quote: CheckoutQuoteDto | null;
  quoteState: CheckoutQuoteState;
}

export interface UseCheckoutResult {
  form: CheckoutFormState;
  errors: CheckoutErrors;
  placing: boolean;
  orderId: string | null;
  resolved: CheckoutResolvedItem[];
  subtotal: number;
  governorates: CheckoutDeliveryGovernorate[] | null;
  quote: CheckoutQuoteDto | null;
  quoteState: CheckoutQuoteState;
  setField: <K extends keyof CheckoutFormState>(key: K, value: CheckoutFormState[K]) => void;
  placeOrder: () => Promise<void>;
}

export interface CheckoutCatalogState {
  products: Product[];
  offers: Offer[];
}
