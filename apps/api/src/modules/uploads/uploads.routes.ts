import { Router } from "express";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { uploadImageController } from "./uploads.controller.js";
import { parseUploadBody } from "./uploads.schemas.js";

export const uploadsRoutes = Router();
uploadsRoutes.post("/", validateBody(parseUploadBody), uploadImageController);
