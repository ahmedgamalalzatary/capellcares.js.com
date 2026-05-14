import type { Request, Response } from "express";
import { createAdminProduct, listAdminProducts } from "./admin-products.service.js";

export function listAdminProductsController(_req: Request, res: Response) {
  listAdminProducts().then((items) => res.json({ items }));
}

export function createAdminProductController(req: Request, res: Response) {
  createAdminProduct(req.body)
    .then((created) => res.status(201).json(created))
    .catch((error: Error) => res.status(400).json({ message: error.message }));
}
