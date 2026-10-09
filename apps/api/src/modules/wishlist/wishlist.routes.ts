import { Router } from "express";
import { wrapAsync } from "../../lib/async-route.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { addWishlistController, listWishlistController, removeWishlistController } from "./wishlist.controller.js";

export const wishlistRoutes = Router();
wishlistRoutes.use(authMiddleware);
wishlistRoutes.get("/", wrapAsync(listWishlistController));
wishlistRoutes.post("/", wrapAsync(addWishlistController));
wishlistRoutes.delete("/:entityType/:entityId", wrapAsync(removeWishlistController));
