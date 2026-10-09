import { Router } from "express";
import { authRateLimitKey, rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { loginController, logoutController, refreshController, signupController } from "./auth.controller.js";
import { parseLoginBody, parseSignupBody } from "./auth.schemas.js";

export const authRoutes = Router();
const signupIpLimit = rateLimit({ keyPrefix: "customer-signup-ip", windowMs: 15 * 60 * 1000, max: 40 });
const signupLimit = rateLimit({ keyPrefix: "customer-signup", windowMs: 15 * 60 * 1000, max: 10, key: authRateLimitKey });
const loginLimit = rateLimit({ keyPrefix: "customer-login", windowMs: 15 * 60 * 1000, max: 10, key: authRateLimitKey });
const refreshLimit = rateLimit({ keyPrefix: "customer-refresh", windowMs: 60 * 1000, max: 30 });

authRoutes.post("/signup", signupIpLimit, signupLimit, validateBody(parseSignupBody), signupController);
authRoutes.post("/login", loginLimit, validateBody(parseLoginBody), loginController);
authRoutes.post("/refresh", refreshLimit, refreshController);
authRoutes.post("/logout", logoutController);
