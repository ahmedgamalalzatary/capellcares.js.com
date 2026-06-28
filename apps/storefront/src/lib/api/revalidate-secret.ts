import { DEV_REVALIDATE_SECRET } from "@/constants/api";

/**
 * Resolve the storefront revalidation secret, failing closed in production so a
 * missing env var is a deployment failure rather than a silent public default.
 */
export function resolveRevalidateSecret(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.STOREFRONT_REVALIDATE_SECRET?.trim();
  if (value) {
    return value;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("Missing required secret: STOREFRONT_REVALIDATE_SECRET must be set in production");
  }
  return DEV_REVALIDATE_SECRET;
}
