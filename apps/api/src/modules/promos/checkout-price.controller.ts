import type { NextFunction, Request, Response } from "express";
import { checkoutPriceRequestSchema, normalizePromoCode, type CheckoutPriceResponseDto } from "@capella/shared";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { priceCheckout } from "../orders/orders.service.js";

// Guessing codes is limited per IP and per account, on every request that checks a typed code (price, delivery quote and
// checkout). Plain cart pricing (no code) is not counted, and neither is the same code again within the window: cart and
// checkout re-price a saved code on every change, which is not a new guess.
const PROMO_WINDOW_MS = 10 * 60 * 1000;
const promoIpLimit = rateLimit({ keyPrefix: "promo-ip", windowMs: PROMO_WINDOW_MS, max: 30 });
const promoAccountLimit = rateLimit({ keyPrefix: "promo-account", windowMs: PROMO_WINDOW_MS, max: 20,
  key: (req) => `customer:${(req as AuthenticatedRequest).user?.id ?? "none"}` });
const recentCodes = new Map<string, number>();
const MAX_RECENT_CODES = 50_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of recentCodes) if (expiresAt <= now) recentCodes.delete(key);
}, 60_000).unref?.();

export function limitPromoAttempts(req: Request, res: Response, next: NextFunction) {
  const promoCode = (req.body as { promoCode?: unknown } | undefined)?.promoCode;
  if (typeof promoCode !== "string" || !promoCode.trim()) return next();
  const userId = (req as AuthenticatedRequest).user?.id;
  const seenKey = `${userId ?? "guest"}:${req.ip ?? "unknown"}:${normalizePromoCode(promoCode)}`;
  if ((recentCodes.get(seenKey) ?? 0) > Date.now()) return next();
  promoIpLimit(req, res, (error?: unknown) => {
    if (error) return next(error);
    const remember = (failure?: unknown) => {
      if (!failure && recentCodes.size < MAX_RECENT_CODES) recentCodes.set(seenKey, Date.now() + PROMO_WINDOW_MS);
      next(failure);
    };
    if (!userId) return remember();
    promoAccountLimit(req, res, remember);
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
