import { Router } from "express";
import { getCollectionBySlugController, listCollectionsController } from "./collections.controller.js";

export const catalogCollectionsRoutes = Router();
catalogCollectionsRoutes.get("/", listCollectionsController);
catalogCollectionsRoutes.get("/:slug", getCollectionBySlugController);
