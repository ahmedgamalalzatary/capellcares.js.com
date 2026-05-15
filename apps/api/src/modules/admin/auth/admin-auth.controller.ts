import type { Request, Response } from "express";
import { loginAdmin } from "./admin-auth.service.js";

export function adminLoginController(req: Request, res: Response) {
  loginAdmin(req.body)
    .then((result) => res.json(result))
    .catch((error: Error) => res.status(401).json({ message: error.message }));
}
