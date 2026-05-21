import { Router } from "express";
import { authRateLimitKey, rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { loginController, logoutController, refreshController, signupController } from "./auth.controller.js";

export const authRoutes = Router();
const loginLimit = rateLimit({ keyPrefix: "customer-login", windowMs: 15 * 60 * 1000, max: 10, key: authRateLimitKey });
const refreshLimit = rateLimit({ keyPrefix: "customer-refresh", windowMs: 60 * 1000, max: 30 });

authRoutes.post("/signup", signupController);
authRoutes.post("/login", loginLimit, loginController);
authRoutes.post("/refresh", refreshLimit, refreshController);
authRoutes.post("/logout", logoutController);
