const DEFAULT_STOREFRONT_BASE_URL = "http://localhost:3000";
const DEFAULT_REVALIDATE_SECRET = "dev-revalidate-secret";

type TriggerStorefrontProductRevalidationOptions = {
  storefrontBaseUrl?: string;
  secret?: string;
};

function resolveStorefrontBaseUrl(): string {
  return (process.env.STOREFRONT_BASE_URL ?? DEFAULT_STOREFRONT_BASE_URL).trim().replace(/\/+$/, "");
}

function resolveRevalidateSecret(): string {
  return (process.env.STOREFRONT_REVALIDATE_SECRET ?? DEFAULT_REVALIDATE_SECRET).trim();
}

export async function triggerStorefrontProductRevalidation(
  slug: string,
  options: TriggerStorefrontProductRevalidationOptions = {}
) {
  const storefrontBaseUrl = (options.storefrontBaseUrl ?? resolveStorefrontBaseUrl()).replace(/\/+$/, "");
  const secret = options.secret ?? resolveRevalidateSecret();

  await fetch(`${storefrontBaseUrl}/api/revalidate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-revalidate-secret": secret
    },
    body: JSON.stringify({
      entity: "product",
      slug
    })
  });
}
