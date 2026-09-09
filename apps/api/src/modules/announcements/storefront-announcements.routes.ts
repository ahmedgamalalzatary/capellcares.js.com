import { Router } from "express";
import { wrapAsync } from "../../lib/async-route.js";
import { listStorefrontAnnouncementsController } from "./storefront-announcements.controller.js";

export const storefrontAnnouncementsRoutes = Router();

storefrontAnnouncementsRoutes.get("/", wrapAsync(listStorefrontAnnouncementsController));
