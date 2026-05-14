export const PRODUCT_STATUS = {
  active: "active",
  inactive: "inactive"
} as const;
export type ProductStatus = (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];
