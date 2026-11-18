import type { NextFunction, Request, Response } from "express";
import { checkoutPriceRequestSchema, type CheckoutPriceResponseDto } from "@capella/shared";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { priceCheckout } from "../orders/orders.service.js";

// Guessing codes is limited per IP and per account; plain cart pricing (no code) is not counted against it.
const promoIpLimit = rateLimit({ keyPrefix: "promo-ip", windowMs: 10 * 60 * 1000, max: 30 });
const promoAccountLimit = rateLimit({ keyPrefix: "promo-account", windowMs: 10 * 60 * 1000, max: 20,
  key: (req) => `customer:${(req as AuthenticatedRequest).user?.id ?? "none"}` });

export function limitPromoAttempts(req: Request, res: Response, next: NextFunction) {
  const promoCode = (req.body as { promoCode?: unknown } | undefined)?.promoCode;
  if (typeof promoCode !== "string" || !promoCode.trim()) return next();
  promoIpLimit(req, res, (error?: unknown) => {
    if (error) return next(error);
    if (!(req as AuthenticatedRequest).user) return next();
    promoAccountLimit(req, res, next);
  });
}

/** The cart priced by the server with the promo code applied, so the storefront shows and submits exactly this total (spec section 5.1). */
export async function checkoutPriceController(req: AuthenticatedRequest, res: Response) {
  const parsed = checkoutPriceRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid cart" });
  const customerId = req.user?.role === "customer" ? req.user.id : null;
  try {
    const priced = await priceCheckout({ ...parsed.data, customerId });
    const response: CheckoutPriceResponseDto = {
      items: priced.items.map((item: { unitPrice: number; lineTotal: number; snapshotBaseUnitPrice: number | null; promoDiscountAmount?: number | null }, index: number) => ({
        index,
        unitPrice: item.unitPrice,
        originalUnitPrice: item.snapshotBaseUnitPrice ?? item.unitPrice,
        lineTotal: item.lineTotal,
        promoDiscount: item.promoDiscountAmount ?? 0
      })),
      productsTotal: priced.totalAmount,
      promo: priced.promo?.dto ?? null
    };
    res.json(response);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Invalid cart" });
  }
}
