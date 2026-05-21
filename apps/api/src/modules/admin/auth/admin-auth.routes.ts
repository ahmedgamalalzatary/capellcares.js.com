import { Router } from "express";
import { authRateLimitKey, rateLimit } from "../../../middlewares/rate-limit.middleware.js";
import { validateBody } from "../../../middlewares/validate.middleware.js";
import { adminLoginController, adminLogoutController, adminRefreshController } from "./admin-auth.controller.js";
import { parseAdminLoginBody } from "./admin-auth.schemas.js";

export const adminAuthRoutes = Router();
const adminLoginLimit = rateLimit({ keyPrefix: "admin-login", windowMs: 15 * 60 * 1000, max: 10, key: authRateLimitKey });
const adminRefreshLimit = rateLimit({ keyPrefix: "admin-refresh", windowMs: 60 * 1000, max: 30 });

adminAuthRoutes.post("/login", adminLoginLimit, validateBody(parseAdminLoginBody), adminLoginController);
adminAuthRoutes.post("/refresh", adminRefreshLimit, adminRefreshController);
adminAuthRoutes.post("/logout", adminLogoutController);
