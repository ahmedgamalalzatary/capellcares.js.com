import { Router } from "express";
import { validateBody } from "../../../middlewares/validate.middleware.js";
import { adminLoginController } from "./admin-auth.controller.js";
import { parseAdminLoginBody } from "./admin-auth.schemas.js";

export const adminAuthRoutes = Router();
adminAuthRoutes.post("/login", validateBody(parseAdminLoginBody), adminLoginController);
