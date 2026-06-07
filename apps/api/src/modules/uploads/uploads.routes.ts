import { Router } from "express";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { uploadMediaController } from "./uploads.controller.js";
import { resolveUploadPermission } from "./uploads.permissions.js";
import { parseUploadBody } from "./uploads.schemas.js";

export const uploadsRoutes = Router();
uploadsRoutes.post(
  "/",
  requireErpPermission((req) => resolveUploadPermission(req.headers["x-capella-upload-context"])),
  validateBody(parseUploadBody),
  uploadMediaController
);
