import { Router } from "express";
import { loginController, refreshController, signupController } from "./auth.controller.js";

export const authRoutes = Router();
authRoutes.post("/signup", signupController);
authRoutes.post("/login", loginController);
authRoutes.post("/refresh", refreshController);
