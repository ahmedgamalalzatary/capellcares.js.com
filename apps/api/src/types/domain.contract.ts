import type { Assert, CheckoutRequestDto, IsEqual, Order as SharedOrder, PaymentStatus as SharedPaymentStatus } from "@capella/shared";
import type { CheckoutPayload, Order, PaymentStatus } from "./domain.js";

type _PaymentStatusMatchesSharedPaymentStatus = Assert<IsEqual<PaymentStatus, SharedPaymentStatus>>;
type _CheckoutPayloadMatchesSharedCheckoutRequest = Assert<IsEqual<CheckoutPayload, CheckoutRequestDto>>;
type _OrderMatchesSharedOrder = Assert<IsEqual<Order, SharedOrder>>;
