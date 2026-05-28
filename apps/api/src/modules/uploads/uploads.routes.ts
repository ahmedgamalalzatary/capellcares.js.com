import { Router } from "express";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { uploadMediaController } from "./uploads.controller.js";
import { parseUploadBody } from "./uploads.schemas.js";

export const uploadsRoutes = Router();
uploadsRoutes.post("/", validateBody(parseUploadBody), uploadMediaController);
