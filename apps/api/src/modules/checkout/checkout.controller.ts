import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { submitCheckout } from "./checkout.service.js";

export function checkoutController(req: AuthenticatedRequest, res: Response) {
  submitCheckout({
    ...req.body,
    customerId: req.user?.role === "customer" ? req.user.id : req.body.customerId ?? null
  })
    .then((order) => res.status(201).json(order))
    .catch((error: Error) => res.status(400).json({ message: error.message }));
}
