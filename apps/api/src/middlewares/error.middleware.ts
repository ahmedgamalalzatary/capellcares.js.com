import type { NextFunction, Request, Response } from "express";

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express only treats 4-argument handlers as error middleware.
export function errorMiddleware(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (process.env.NODE_ENV !== "test") {
    // Full error (message + stack) stays in server logs only; the query string is dropped so tokens never reach the log.
    console.error(`Unhandled API error on ${req.method} ${req.originalUrl.split("?")[0]}`, error);
  }
  const statusCode = 500;
  res.status(statusCode).json({ error: "Internal server error" });
}
