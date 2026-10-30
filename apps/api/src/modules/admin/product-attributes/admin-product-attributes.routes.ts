import { Router } from "express";
import { wrapAsync } from "../../../lib/async-route.js";
import { requireErpPermission } from "../../../middlewares/erp-permissions.middleware.js";
import {
  adminDeleteSupplier,
  adminListSuppliers,
  adminUpsertSupplier,
  ageGroupHandlers,
  brandHandlers,
  characterHandlers
} from "./admin-product-attributes.controller.js";

export const adminProductAttributeRoutes = Router();

for (const [path, handlers] of [
  ["/brands", brandHandlers],
  ["/characters", characterHandlers],
  ["/age-groups", ageGroupHandlers]
] as const) {
  adminProductAttributeRoutes.get(path, requireErpPermission("products.read"), wrapAsync(handlers.adminList));
  adminProductAttributeRoutes.post(path, requireErpPermission("products.update"), wrapAsync(handlers.upsert));
  adminProductAttributeRoutes.post(`${path}/reorder`, requireErpPermission("products.update"), wrapAsync(handlers.reorder));
  adminProductAttributeRoutes.delete(`${path}/:id`, requireErpPermission("products.update"), wrapAsync(handlers.remove));
}

adminProductAttributeRoutes.get("/suppliers", requireErpPermission("products.read"), wrapAsync(adminListSuppliers));
adminProductAttributeRoutes.post("/suppliers", requireErpPermission("products.update"), wrapAsync(adminUpsertSupplier));
adminProductAttributeRoutes.delete("/suppliers/:id", requireErpPermission("products.update"), wrapAsync(adminDeleteSupplier));

export const storefrontProductAttributeRoutes = Router();
storefrontProductAttributeRoutes.get("/brands", wrapAsync(brandHandlers.storefrontList));
storefrontProductAttributeRoutes.get("/characters", wrapAsync(characterHandlers.storefrontList));
storefrontProductAttributeRoutes.get("/age-groups", wrapAsync(ageGroupHandlers.storefrontList));
