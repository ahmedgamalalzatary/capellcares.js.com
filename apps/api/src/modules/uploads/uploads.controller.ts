import type { Request, Response } from "express";
import { uploadBase64Image } from "./uploads.service.js";

export function uploadImageController(req: Request, res: Response) {
  uploadBase64Image(req.body)
    .then((result) => res.status(201).json(result))
    .catch((error: Error) => res.status(400).json({ message: error.message }));
}
