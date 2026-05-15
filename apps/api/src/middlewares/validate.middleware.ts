import type { NextFunction, Request, Response } from "express";

type Validator<T> = (input: unknown) => T;

export function validateBody<T>(validator: Validator<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = validator(req.body) as Request["body"];
      next();
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid request payload"
      });
    }
  };
}
