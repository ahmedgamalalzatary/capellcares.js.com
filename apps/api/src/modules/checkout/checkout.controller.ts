import type { Request, Response } from "express";
import { submitCheckout } from "./checkout.service.js";

export function checkoutController(req: Request, res: Response) {
  submitCheckout(req.body)
    .then((order) => res.status(201).json(order))
    .catch((error: Error) => res.status(400).json({ message: error.message }));
}
