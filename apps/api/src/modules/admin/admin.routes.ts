import { Router } from "express";
import {
  adminListProducts,
  adminGetProduct,
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
  adminListCollections,
  adminGetOffer,
  adminGetCollection,
  adminUpsertOffer,
  adminUpsertCollection,
  adminSoftDeleteOffer,
  adminSoftDeleteCollection,
  adminRestoreOffer,
  adminRestoreCollection,
  adminToggleOfferStatus,
  adminToggleCollectionStatus
} from "./admin.controller.js";
import { adminAdvicesRoutes } from "../advices/admin-advices.routes.js";
import { adminOrdersRoutes } from "../orders/admin-orders.routes.js";
import { getAdminSalesController } from "../orders/orders.controller.js";

export const adminRoutes = Router();

adminRoutes.get("/products", adminListProducts);
adminRoutes.get("/products/:id", adminGetProduct);
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
adminRoutes.get("/offers/:id", adminGetOffer);
adminRoutes.post("/offers", adminUpsertOffer);
adminRoutes.delete("/offers/:id", adminSoftDeleteOffer);
adminRoutes.post("/offers/:id/restore", adminRestoreOffer);
adminRoutes.post("/offers/:id/toggle-status", adminToggleOfferStatus);

adminRoutes.get("/collections", adminListCollections);
adminRoutes.get("/collections/:id", adminGetCollection);
adminRoutes.post("/collections", adminUpsertCollection);
adminRoutes.delete("/collections/:id", adminSoftDeleteCollection);
adminRoutes.post("/collections/:id/restore", adminRestoreCollection);
adminRoutes.post("/collections/:id/toggle-status", adminToggleCollectionStatus);
adminRoutes.use("/advices", adminAdvicesRoutes);
adminRoutes.use("/orders", adminOrdersRoutes);
