import { checkoutSchema } from "@capella/shared/schemas";
import type { CheckoutRequestDto } from "@capella/shared/dto";

export function parseCheckoutBody(input: unknown): CheckoutRequestDto {
  return checkoutSchema.parse(input);
}
