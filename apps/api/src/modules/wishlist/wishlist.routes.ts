import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { addWishlistController, listWishlistController, removeWishlistController } from "./wishlist.controller.js";

export const wishlistRoutes = Router();
wishlistRoutes.use(authMiddleware);
wishlistRoutes.get("/", listWishlistController);
wishlistRoutes.post("/", addWishlistController);
wishlistRoutes.delete("/:entityType/:entityId", removeWishlistController);
