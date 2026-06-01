import { Router } from "express";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { uploadMediaController } from "./uploads.controller.js";
import { parseUploadBody } from "./uploads.schemas.js";

export const uploadsRoutes = Router();
uploadsRoutes.post(
  "/",
  requireErpPermission((req) => {
    const context = req.headers["x-capella-upload-context"];
    if (context === "products.update" || context === "offers.update" || context === "collections.update" || context === "advices.update") {
      return context;
    }
    return null;
  }),
  validateBody(parseUploadBody),
  uploadMediaController
);
