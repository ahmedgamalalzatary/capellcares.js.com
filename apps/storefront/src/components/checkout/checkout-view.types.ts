import type { Language, Offer, PaymentMethod, Product } from "@capella/shared";

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
}

export interface CheckoutFormProps extends CheckoutViewProps {
  form: CheckoutFormState;
  errors: CheckoutErrors;
  placing: boolean;
  setField: <K extends keyof CheckoutFormState>(key: K, value: CheckoutFormState[K]) => void;
  placeOrder: () => Promise<void>;
}

export interface CheckoutSummaryProps extends CheckoutViewProps {
  resolved: CheckoutResolvedItem[];
  subtotal: number;
}

export interface UseCheckoutResult {
  form: CheckoutFormState;
  errors: CheckoutErrors;
  placing: boolean;
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
