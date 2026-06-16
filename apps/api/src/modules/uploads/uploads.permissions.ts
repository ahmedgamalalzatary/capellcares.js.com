import type { ErpPermissionKey } from "../../services/erp-permissions.service.js";

// Image/media uploads are gated by the action the editor is performing. Both
// create and update flows may upload, so a brand-new offer/collection/product/
// advice can attach an image before it is first saved.
const UPLOAD_CONTEXT_PERMISSIONS = new Set<ErpPermissionKey>([
  "products.create",
  "products.update",
  "categories.create",
  "categories.update",
  "offers.create",
  "offers.update",
  "collections.create",
  "collections.update",
  "advices.create",
  "advices.update",
  "shop_media.update"
]);

export function resolveUploadPermission(context: unknown): ErpPermissionKey | null {
  if (typeof context === "string" && UPLOAD_CONTEXT_PERMISSIONS.has(context as ErpPermissionKey)) {
    return context as ErpPermissionKey;
  }
  return null;
}
