import { Router } from "express";
import { wrapAsync } from "../../lib/async-route.js";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
import {
  adminChangePromoCodeStatus,
  adminCreatePromoCode,
  adminGetPromoCode,
  adminListPromoCodes,
  adminSearchPromoCustomers
} from "./admin-promo-codes.controller.js";

// No PUT, PATCH or DELETE on purpose: a promo code's rules never change after creation and codes are never deleted.
export const adminPromoCodesRoutes = Router();

adminPromoCodesRoutes.get("/", requireErpPermission("promos.read"), wrapAsync(adminListPromoCodes));
adminPromoCodesRoutes.post("/", requireErpPermission("promos.create"), wrapAsync(adminCreatePromoCode));
adminPromoCodesRoutes.get("/customers", requireErpPermission("promos.create"), wrapAsync(adminSearchPromoCustomers));
adminPromoCodesRoutes.get("/:id", requireErpPermission("promos.read"), wrapAsync(adminGetPromoCode));
adminPromoCodesRoutes.post("/:id/status", requireErpPermission("promos.update_status"), wrapAsync(adminChangePromoCodeStatus));
