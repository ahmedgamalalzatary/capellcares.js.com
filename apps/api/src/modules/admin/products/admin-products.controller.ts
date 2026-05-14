import type { Request, Response } from "express";
import { createAdminProduct, listAdminProducts } from "./admin-products.service.js";

export function listAdminProductsController(_req: Request, res: Response) {
  res.json({ items: listAdminProducts() });
}

export function createAdminProductController(req: Request, res: Response) {
  try {
    const created = createAdminProduct(req.body);
    return res.status(201).json(created);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
}
