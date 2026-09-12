import type { NextFunction, Request, Response } from "express";

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (process.env.NODE_ENV !== "test") {
    console.error("Unhandled API error", error instanceof Error ? error.name : "unknown");
  }
  const statusCode = 500;
  res.status(statusCode).json({ error: "Internal server error" });
}
