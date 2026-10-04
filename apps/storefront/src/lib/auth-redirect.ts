import type { Language } from "@capella/shared";

/** Query key carrying "where the customer was headed" into /login and /signup. */
export const NEXT_PARAM = "next";

/** Build a login/signup href that remembers the current page. Gated pages (orders, wishlist, checkout) previously dumped everyone on `/{lang}` after authenticating, losing what they were trying to reach; passing the origin through as a query param lets the form return them to it. */
export function authHref(target: "login" | "signup", lang: Language, next?: string | null): string {
  const base = `/${lang}/${target}`;
  if (!next) return base;
  const safe = sanitizeNext(next, lang);
  return safe ? `${base}?${NEXT_PARAM}=${encodeURIComponent(safe)}` : base;
}

/** Reduce an untrusted `next` value to a same-origin path under the active locale, or null when it cannot be trusted.
 * It reaches us through the URL and is attacker-controllable — without this an emailed `/en/login?next=https://evil.example` would make our login an open redirect; only a single-slash-prefixed path survives, ruling out absolute URLs, scheme-relative `//evil.example`, and backslashes a browser may normalise into a host. */
export function sanitizeNext(next: string | null | undefined, lang: Language): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;

  // Strip both the query and the hash: `/en/login#restore` otherwise slipped past the auth-loop guard below.
  const path = next.split(/[?#]/)[0] ?? "";
  const hasDotSegment = path.split("/").some((segment) => {
    try {
      const decoded = decodeURIComponent(segment);
      return decoded === "." || decoded === "..";
    } catch {
      return true;
    }
  });
  if (hasDotSegment) return null;

  // Every storefront route is locale-prefixed, so anything outside the active locale is either a cross-locale bounce or not one of our pages at all.
  if (path !== `/${lang}` && !path.startsWith(`/${lang}/`)) return null;

  // Never bounce back to the auth pages themselves — that traps the customer in a loop the moment the form redirects to where they "came from".
  if (path === `/${lang}/login` || path === `/${lang}/signup`) return null;

  return next;
}

/** Where the form should land after a successful login/signup. */
export function resolveAuthDestination(next: string | null | undefined, lang: Language): string {
  return sanitizeNext(next, lang) ?? `/${lang}`;
}
