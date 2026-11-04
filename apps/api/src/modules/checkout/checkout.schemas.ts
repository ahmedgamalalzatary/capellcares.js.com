import { checkoutQuoteSchema, checkoutSchema } from "@capella/shared/schemas";
import type { CheckoutQuoteRequestDto, CheckoutRequestDto } from "@capella/shared/dto";

export function parseCheckoutBody(input: unknown): CheckoutRequestDto {
  return checkoutSchema.parse(input);
}

export function parseCheckoutQuoteBody(input: unknown): CheckoutQuoteRequestDto {
  return checkoutQuoteSchema.parse(input);
}
