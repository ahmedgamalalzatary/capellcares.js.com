import type { Request, Response } from "express";
import { uploadBase64Media } from "./uploads.service.js";

export function uploadMediaController(req: Request, res: Response) {
  uploadBase64Media(req.body)
    .then((result) => res.status(201).json(result))
    .catch((error: Error) => res.status(400).json({ message: error.message }));
}
