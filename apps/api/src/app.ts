import express from "express";
import { apiRoutes } from "./routes/index.js";

export const app = express();

app.use(express.json());
app.use(apiRoutes);
