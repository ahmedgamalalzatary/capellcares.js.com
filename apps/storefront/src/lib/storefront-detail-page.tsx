import type { ReactElement } from "react";
import { getDict } from "@capella/shared";
import { notFound } from "next/navigation";

import { resolveStorefrontLang } from "./storefront-page-context";

export async function resolveStorefrontSlugPageContext(params: Promise<{ lang: string; slug: string }>) {
  const [{ slug }, lang] = await Promise.all([params, resolveStorefrontLang(params)]);

  return {
    lang,
    slug,
    dict: getDict(lang)
  };
}

export function requireStorefrontValue<T>(
  value: T,
  predicate: (candidate: T) => boolean = (candidate) => candidate == null
): NonNullable<T> {
  if (predicate(value)) {
    notFound();
  }

  return value as NonNullable<T>;
}

export function StorefrontJsonLd({ payloads }: { payloads: unknown[] }): ReactElement {
  return (
    <>
      {payloads.map((payload, index) => (
        <script
          key={index}
          data-testid="json-ld-script"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
        />
      ))}
    </>
  );
}
