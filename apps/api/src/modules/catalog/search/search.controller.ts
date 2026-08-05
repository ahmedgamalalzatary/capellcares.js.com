import type { Request, Response } from "express";
import { searchStorefront } from "./search.service.js";

export async function searchStorefrontController(req: Request, res: Response) {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query || query.length > 100) {
    return res.status(400).json({ message: "Search query must be between 1 and 100 characters" });
  }
  return res.json(await searchStorefront(query));
}
