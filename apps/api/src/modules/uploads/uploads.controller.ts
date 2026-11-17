import type { NextFunction, Request, Response } from "express";
import { uploadBase64Media, UploadRejectedError } from "./uploads.service.js";

export function uploadMediaController(req: Request, res: Response, next: NextFunction) {
  uploadBase64Media(req.body)
    .then((result) => res.status(201).json(result))
    .catch((error: unknown) => {
      if (error instanceof UploadRejectedError) return res.status(400).json({ message: error.message });
      // Disk/permission failures carry server paths; the error middleware logs them and answers with a generic 500.
      return next(error);
    });
}
