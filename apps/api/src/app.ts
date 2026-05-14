import express from "express";
import cors from "cors";
import { apiRoutes } from "./routes/index.js";

export const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(apiRoutes);
