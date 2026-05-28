import { Router } from "express";
import {
  adminListProducts,
  adminUpsertProduct,
  adminSoftDeleteProduct,
  adminRestoreProduct,
  adminHardDeleteProduct,
  adminToggleProductStatus,
  adminSetVariantStock,
  adminListCategories,
  adminUpsertCategory,
  adminSoftDeleteCategory,
  adminRestoreCategory,
  adminListOffers,
  adminUpsertOffer,
  adminSoftDeleteOffer,
  adminRestoreOffer,
  adminToggleOfferStatus
} from "./admin.controller.js";
import { adminAdvicesRoutes } from "../advices/admin-advices.routes.js";
import { adminOrdersRoutes } from "../orders/admin-orders.routes.js";
import { getAdminSalesController } from "../orders/orders.controller.js";

export const adminRoutes = Router();

adminRoutes.get("/products", adminListProducts);
adminRoutes.post("/products", adminUpsertProduct);
adminRoutes.delete("/products/:id", adminSoftDeleteProduct);
adminRoutes.post("/products/:id/restore", adminRestoreProduct);
adminRoutes.delete("/products/:id/permanent", adminHardDeleteProduct);
adminRoutes.post("/products/:id/toggle-status", adminToggleProductStatus);
adminRoutes.post("/products/:id/variants/:variantId/stock", adminSetVariantStock);

adminRoutes.get("/categories", adminListCategories);
adminRoutes.post("/categories", adminUpsertCategory);
adminRoutes.delete("/categories/:id", adminSoftDeleteCategory);
adminRoutes.post("/categories/:id/restore", adminRestoreCategory);
adminRoutes.get("/sales", getAdminSalesController);

adminRoutes.get("/offers", adminListOffers);
adminRoutes.post("/offers", adminUpsertOffer);
adminRoutes.delete("/offers/:id", adminSoftDeleteOffer);
adminRoutes.post("/offers/:id/restore", adminRestoreOffer);
adminRoutes.post("/offers/:id/toggle-status", adminToggleOfferStatus);
adminRoutes.use("/advices", adminAdvicesRoutes);
adminRoutes.use("/orders", adminOrdersRoutes);
