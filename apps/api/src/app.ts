import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { resolve } from "node:path";
import { apiRoutes } from "./routes/index.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { resolveAllowedOrigins } from "./config/cors.js";
import { bostaWebhookRoutes } from "./modules/shipping/bosta/bosta-webhook.routes.js";

export const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");
// maxAge lets browsers reuse a preflight answer (Firefox up to 24h, Chromium caps at 2h) instead of sending OPTIONS before every ERP call.
app.use(cors({ origin: resolveAllowedOrigins(), credentials: true, maxAge: 86_400 }));
app.use(bostaWebhookRoutes);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(resolve(process.cwd(), "uploads")));
app.use(apiRoutes);
app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});
app.use(errorMiddleware);
