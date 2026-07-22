import { resolveSecret } from "../../config/secrets.js";

const DEFAULT_STOREFRONT_BASE_URL = "http://localhost:3000";
const DEFAULT_REVALIDATE_SECRET = "dev-revalidate-secret";
const DEFAULT_REVALIDATION_TIMEOUT_MS = 5_000;

export type StorefrontRevalidatePayload = {
  entity: "product" | "offer" | "collection" | "advice" | "homepage-banners" | "announcement-bar";
  slug?: string;
  previousSlug?: string;
  categorySlugs?: string[];
  relatedProductSlugs?: string[];
};

type TriggerStorefrontRevalidationOptions = {
  storefrontBaseUrl?: string;
  secret?: string;
  timeoutMs?: number;
};

function resolveStorefrontBaseUrl(): string {
  return (process.env.STOREFRONT_BASE_URL ?? DEFAULT_STOREFRONT_BASE_URL).trim().replace(/\/+$/, "");
}

function resolveRevalidateSecret(): string {
  return resolveSecret("STOREFRONT_REVALIDATE_SECRET", {
    value: process.env.STOREFRONT_REVALIDATE_SECRET,
    devFallback: DEFAULT_REVALIDATE_SECRET
  }).trim();
}

function shouldSkipStorefrontRevalidation(): boolean {
  return process.env.NODE_ENV === "test";
}

export async function triggerStorefrontRevalidation(
  payload: StorefrontRevalidatePayload,
  options: TriggerStorefrontRevalidationOptions = {}
) {
  if (shouldSkipStorefrontRevalidation()) {
    return;
  }

  const storefrontBaseUrl = (options.storefrontBaseUrl ?? resolveStorefrontBaseUrl()).replace(/\/+$/, "");
  const secret = options.secret ?? resolveRevalidateSecret();
  const timeoutMs = options.timeoutMs ?? DEFAULT_REVALIDATION_TIMEOUT_MS;
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const response = await Promise.race([
      fetch(`${storefrontBaseUrl}/api/revalidate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-revalidate-secret": secret
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      }),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error(`Storefront revalidation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);

    if (!response.ok) {
      throw new Error(`Storefront revalidation failed with status ${response.status}`);
    }
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
