export const PAYMENT_METHODS = {
  cod: "cod"
} as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

/** Kuwaiti mobile: 8 digits starting 5, 6 or 9, optionally prefixed with +965 or 00965. */
export const KW_PHONE_REGEX = /^(?:\+965|00965)?[569]\d{7}$/;
