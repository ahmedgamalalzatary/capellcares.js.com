import { Router } from "express";
import { wrapAsync } from "../../lib/async-route.js";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
import {
  adminListProducts,
  adminGetProduct,
  adminReorderProducts,
  adminUpsertProduct,
  adminUpdateProductDiscounts,
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
  adminHardDeleteCategory,
  adminListOffers,
  adminListCollections,
  adminReorderOffers,
  adminReorderCollections,
  adminGetOffer,
  adminGetCollection,
  adminUpsertOffer,
  adminUpsertCollection,
  adminSoftDeleteOffer,
  adminSoftDeleteCollection,
  adminRestoreOffer,
  adminHardDeleteOffer,
  adminRestoreCollection,
  adminHardDeleteCollection,
  adminToggleOfferStatus,
  adminToggleCollectionStatus
} from "./admin.controller.js";
import { adminAdvicesRoutes } from "./advices/admin-advices.routes.js";
import { adminShopMediaRoutes } from "./shop-media/admin-shop-media.routes.js";
import { adminOrdersRoutes } from "../orders/admin-orders.routes.js";
import { getAdminSalesController } from "../orders/orders.controller.js";
import { adminStaffManagementRoutes } from "./staff-management/admin-staff-management.routes.js";
import { adminReviewsRoutes } from "./reviews/admin-reviews.routes.js";

export const adminRoutes = Router();

adminRoutes.get("/products", requireErpPermission("products.read"), wrapAsync(adminListProducts));
adminRoutes.get("/products/:id", requireErpPermission("products.read"), wrapAsync(adminGetProduct));
adminRoutes.post("/products", requireErpPermission((req) => (req.body?.id ? "products.update" : "products.create")), wrapAsync(adminUpsertProduct));
adminRoutes.post("/products/:id/discount", requireErpPermission("products.discount"), wrapAsync(adminUpdateProductDiscounts));
adminRoutes.post("/products/reorder", requireErpPermission("products.update"), wrapAsync(adminReorderProducts));
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
adminRoutes.delete("/categories/:id/permanent", requireErpPermission("categories.permanent_delete"), wrapAsync(adminHardDeleteCategory));
adminRoutes.get("/sales", requireErpPermission("sales.read"), wrapAsync(getAdminSalesController));

adminRoutes.get("/offers", requireErpPermission("offers.read"), wrapAsync(adminListOffers));
adminRoutes.get("/offers/:id", requireErpPermission("offers.read"), wrapAsync(adminGetOffer));
adminRoutes.post("/offers", requireErpPermission((req) => (req.body?.id ? "offers.update" : "offers.create")), wrapAsync(adminUpsertOffer));
adminRoutes.post("/offers/reorder", requireErpPermission("offers.update"), wrapAsync(adminReorderOffers));
adminRoutes.delete("/offers/:id", requireErpPermission("offers.soft_delete"), wrapAsync(adminSoftDeleteOffer));
adminRoutes.post("/offers/:id/restore", requireErpPermission("offers.restore"), wrapAsync(adminRestoreOffer));
adminRoutes.delete("/offers/:id/permanent", requireErpPermission("offers.permanent_delete"), wrapAsync(adminHardDeleteOffer));
adminRoutes.post("/offers/:id/toggle-status", requireErpPermission("offers.toggle_status"), wrapAsync(adminToggleOfferStatus));

adminRoutes.get("/collections", requireErpPermission("collections.read"), wrapAsync(adminListCollections));
adminRoutes.get("/collections/:id", requireErpPermission("collections.read"), wrapAsync(adminGetCollection));
adminRoutes.post("/collections", requireErpPermission((req) => (req.body?.id ? "collections.update" : "collections.create")), wrapAsync(adminUpsertCollection));
adminRoutes.post("/collections/reorder", requireErpPermission("collections.update"), wrapAsync(adminReorderCollections));
adminRoutes.delete("/collections/:id", requireErpPermission("collections.soft_delete"), wrapAsync(adminSoftDeleteCollection));
adminRoutes.post("/collections/:id/restore", requireErpPermission("collections.restore"), wrapAsync(adminRestoreCollection));
adminRoutes.delete("/collections/:id/permanent", requireErpPermission("collections.permanent_delete"), wrapAsync(adminHardDeleteCollection));
adminRoutes.post("/collections/:id/toggle-status", requireErpPermission("collections.toggle_status"), wrapAsync(adminToggleCollectionStatus));
adminRoutes.use("/staff", adminStaffManagementRoutes);
adminRoutes.use("/advices", adminAdvicesRoutes);
adminRoutes.use("/shop-media-sections", adminShopMediaRoutes);
adminRoutes.use("/orders", adminOrdersRoutes);
adminRoutes.use("/reviews", adminReviewsRoutes);
