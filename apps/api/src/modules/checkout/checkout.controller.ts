import type { Request, Response } from "express";
import { submitCheckout } from "./checkout.service.js";

export function checkoutController(req: Request, res: Response) {
  try {
    const order = submitCheckout(req.body);
    return res.status(201).json(order);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}
