import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { resolve } from "node:path";
import { apiRoutes } from "./routes/index.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";

export const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(resolve(process.cwd(), "uploads")));
app.use(apiRoutes);
app.use(errorMiddleware);
