import type { Request, Response } from "express";

export function errorMiddleware(error: unknown, _req: Request, res: Response) {
  const message = error instanceof Error ? error.message : "Internal server error";
  const statusCode = 500;
  res.status(statusCode).json({ error: message });
}
