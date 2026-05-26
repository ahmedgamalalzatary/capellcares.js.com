import type { CheckoutRequestDto } from "./checkout.dto.js";
import type { Assert, IsEqual, Order, OrderItem, OrderSummary } from "../types/index.js";
import type { CreateOrderDto, OrderDto, OrderItemDto, OrderSummaryDto } from "./order.dto.js";

type _OrderItemDtoMatchesSharedOrderItem = Assert<IsEqual<OrderItemDto, OrderItem>>;
type _OrderSummaryDtoMatchesSharedOrderSummary = Assert<IsEqual<OrderSummaryDto, OrderSummary>>;
type _OrderDtoMatchesSharedOrder = Assert<IsEqual<OrderDto, Order>>;
type _CreateOrderDtoUsesSharedCheckoutItems = Assert<IsEqual<CreateOrderDto["checkout"], CheckoutRequestDto["items"]>>;
