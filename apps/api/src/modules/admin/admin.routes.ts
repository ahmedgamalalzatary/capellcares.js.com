import { Router } from "express";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
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
import { adminStaffManagementRoutes } from "./staff-management/admin-staff-management.routes.js";

export const adminRoutes = Router();

adminRoutes.get("/products", requireErpPermission("products.read"), adminListProducts);
adminRoutes.get("/products/:id", requireErpPermission("products.read"), adminGetProduct);
adminRoutes.post("/products", requireErpPermission((req) => (req.body?.id ? "products.update" : "products.create")), adminUpsertProduct);
adminRoutes.delete("/products/:id", requireErpPermission("products.soft_delete"), adminSoftDeleteProduct);
adminRoutes.post("/products/:id/restore", requireErpPermission("products.restore"), adminRestoreProduct);
adminRoutes.delete("/products/:id/permanent", requireErpPermission("products.permanent_delete"), adminHardDeleteProduct);
adminRoutes.post("/products/:id/toggle-status", requireErpPermission("products.toggle_status"), adminToggleProductStatus);
adminRoutes.post("/products/:id/variants/:variantId/stock", requireErpPermission("products.stock_update"), adminSetVariantStock);

adminRoutes.get("/categories", requireErpPermission("categories.read"), adminListCategories);
adminRoutes.post("/categories", requireErpPermission((req) => (req.body?.id ? "categories.update" : "categories.create")), adminUpsertCategory);
adminRoutes.delete("/categories/:id", requireErpPermission("categories.soft_delete"), adminSoftDeleteCategory);
adminRoutes.post("/categories/:id/restore", requireErpPermission("categories.restore"), adminRestoreCategory);
adminRoutes.get("/sales", requireErpPermission("sales.read"), getAdminSalesController);

adminRoutes.get("/offers", requireErpPermission("offers.read"), adminListOffers);
adminRoutes.get("/offers/:id", requireErpPermission("offers.read"), adminGetOffer);
adminRoutes.post("/offers", requireErpPermission((req) => (req.body?.id ? "offers.update" : "offers.create")), adminUpsertOffer);
adminRoutes.delete("/offers/:id", requireErpPermission("offers.soft_delete"), adminSoftDeleteOffer);
adminRoutes.post("/offers/:id/restore", requireErpPermission("offers.restore"), adminRestoreOffer);
adminRoutes.post("/offers/:id/toggle-status", requireErpPermission("offers.toggle_status"), adminToggleOfferStatus);

adminRoutes.get("/collections", requireErpPermission("collections.read"), adminListCollections);
adminRoutes.get("/collections/:id", requireErpPermission("collections.read"), adminGetCollection);
adminRoutes.post("/collections", requireErpPermission((req) => (req.body?.id ? "collections.update" : "collections.create")), adminUpsertCollection);
adminRoutes.delete("/collections/:id", requireErpPermission("collections.soft_delete"), adminSoftDeleteCollection);
adminRoutes.post("/collections/:id/restore", requireErpPermission("collections.restore"), adminRestoreCollection);
adminRoutes.post("/collections/:id/toggle-status", requireErpPermission("collections.toggle_status"), adminToggleCollectionStatus);
adminRoutes.use("/staff", adminStaffManagementRoutes);
adminRoutes.use("/advices", adminAdvicesRoutes);
adminRoutes.use("/orders", adminOrdersRoutes);
