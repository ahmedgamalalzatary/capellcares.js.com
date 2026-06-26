import { checkoutSchema } from "@minikoshk/shared/schemas";
import type { CheckoutRequestDto } from "@minikoshk/shared/dto";

export function parseCheckoutBody(input: unknown): CheckoutRequestDto {
  return checkoutSchema.parse(input);
}
