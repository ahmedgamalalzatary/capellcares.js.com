import { Router } from "express";
import { wrapAsync } from "../../lib/async-route.js";
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
  adminReorderCategories,
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
import { adminAdvicesRoutes } from "./advices/admin-advices.routes.js";
import { adminOrdersRoutes } from "../orders/admin-orders.routes.js";
import { getAdminSalesController } from "../orders/orders.controller.js";
import { adminStaffManagementRoutes } from "./staff-management/admin-staff-management.routes.js";

export const adminRoutes = Router();

adminRoutes.get("/products", requireErpPermission("products.read"), wrapAsync(adminListProducts));
adminRoutes.get("/products/:id", requireErpPermission("products.read"), wrapAsync(adminGetProduct));
adminRoutes.post("/products", requireErpPermission((req) => (req.body?.id ? "products.update" : "products.create")), wrapAsync(adminUpsertProduct));
adminRoutes.delete("/products/:id", requireErpPermission("products.soft_delete"), wrapAsync(adminSoftDeleteProduct));
adminRoutes.post("/products/:id/restore", requireErpPermission("products.restore"), wrapAsync(adminRestoreProduct));
adminRoutes.delete("/products/:id/permanent", requireErpPermission("products.permanent_delete"), wrapAsync(adminHardDeleteProduct));
adminRoutes.post("/products/:id/toggle-status", requireErpPermission("products.toggle_status"), wrapAsync(adminToggleProductStatus));
adminRoutes.post("/products/:id/variants/:variantId/stock", requireErpPermission("products.stock_update"), wrapAsync(adminSetVariantStock));

adminRoutes.get("/categories", requireErpPermission("categories.read"), wrapAsync(adminListCategories));
adminRoutes.post("/categories", requireErpPermission((req) => (req.body?.id ? "categories.update" : "categories.create")), wrapAsync(adminUpsertCategory));
adminRoutes.post("/categories/reorder", requireErpPermission("categories.update"), wrapAsync(adminReorderCategories));
adminRoutes.delete("/categories/:id", requireErpPermission("categories.soft_delete"), wrapAsync(adminSoftDeleteCategory));
adminRoutes.post("/categories/:id/restore", requireErpPermission("categories.restore"), wrapAsync(adminRestoreCategory));
adminRoutes.get("/sales", requireErpPermission("sales.read"), wrapAsync(getAdminSalesController));

adminRoutes.get("/offers", requireErpPermission("offers.read"), wrapAsync(adminListOffers));
adminRoutes.get("/offers/:id", requireErpPermission("offers.read"), wrapAsync(adminGetOffer));
adminRoutes.post("/offers", requireErpPermission((req) => (req.body?.id ? "offers.update" : "offers.create")), wrapAsync(adminUpsertOffer));
adminRoutes.delete("/offers/:id", requireErpPermission("offers.soft_delete"), wrapAsync(adminSoftDeleteOffer));
adminRoutes.post("/offers/:id/restore", requireErpPermission("offers.restore"), wrapAsync(adminRestoreOffer));
adminRoutes.post("/offers/:id/toggle-status", requireErpPermission("offers.toggle_status"), wrapAsync(adminToggleOfferStatus));

adminRoutes.get("/collections", requireErpPermission("collections.read"), wrapAsync(adminListCollections));
adminRoutes.get("/collections/:id", requireErpPermission("collections.read"), wrapAsync(adminGetCollection));
adminRoutes.post("/collections", requireErpPermission((req) => (req.body?.id ? "collections.update" : "collections.create")), wrapAsync(adminUpsertCollection));
adminRoutes.delete("/collections/:id", requireErpPermission("collections.soft_delete"), wrapAsync(adminSoftDeleteCollection));
adminRoutes.post("/collections/:id/restore", requireErpPermission("collections.restore"), wrapAsync(adminRestoreCollection));
adminRoutes.post("/collections/:id/toggle-status", requireErpPermission("collections.toggle_status"), wrapAsync(adminToggleCollectionStatus));
adminRoutes.use("/staff", adminStaffManagementRoutes);
adminRoutes.use("/advices", adminAdvicesRoutes);
adminRoutes.use("/orders", adminOrdersRoutes);
