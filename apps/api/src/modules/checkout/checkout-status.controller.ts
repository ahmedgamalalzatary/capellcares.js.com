import type { Request, Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutSessions, orders, paymentAttempts } from "@capella/database/drizzle/schema";

export async function getCheckoutStatusController(req: Request, res: Response): Promise<void> {
  const checkoutId = req.params.checkoutId;
  if (!/^checkout_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(checkoutId)) {
    res.status(404).json({ message: "Checkout not found" });
    return;
  }
  const [session] = await db.select({
    checkoutId: checkoutSessions.publicId,
    status: checkoutSessions.state,
    expiresAt: checkoutSessions.reservationExpiresAt,
    sessionId: checkoutSessions.id,
    attemptsUsed: checkoutSessions.attemptCount,
    orderId: orders.id,
    orderCode: orders.orderCode
  }).from(checkoutSessions)
    .leftJoin(orders, eq(orders.id, checkoutSessions.createdOrderId))
    .where(eq(checkoutSessions.publicId, checkoutId)).limit(1);
  if (!session) {
    res.status(404).json({ message: "Checkout not found" });
    return;
  }
  const [latestAttempt] = await db.select({ status: paymentAttempts.status }).from(paymentAttempts)
    .where(eq(paymentAttempts.checkoutSessionId, session.sessionId))
    .orderBy(desc(paymentAttempts.attemptNumber)).limit(1);
  res.status(200).json({
    checkoutId: session.checkoutId,
    status: session.status,
    expiresAt: session.expiresAt.toISOString(),
    attemptsUsed: session.attemptsUsed,
    latestAttemptStatus: latestAttempt?.status ?? null,
    canRetry: session.status === "payment_pending" && latestAttempt?.status === "failed" &&
      session.attemptsUsed < 3 && session.expiresAt > new Date(),
    order: session.orderId && session.orderCode ? { id: session.orderId, orderCode: session.orderCode } : null
  });
}
