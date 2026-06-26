import { languages, defaultLanguage, type Language } from "@minikoshk/shared";

const isLanguage = (value: string): value is Language => (languages as readonly string[]).includes(value);

/** The locale segment of a pathname, or null if it isn't prefixed with one. */
export function localeFromPathname(pathname: string): Language | null {
  const first = pathname.split("/").filter(Boolean)[0];
  return first && isLanguage(first) ? first : null;
}

/** Return `pathname` rewritten to use `lang`, swapping or inserting the prefix. */
export function withLocale(pathname: string, lang: Language): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && isLanguage(segments[0])) {
    segments[0] = lang;
  } else {
    segments.unshift(lang);
  }
  return `/${segments.join("/")}`;
}

/**
 * For middleware: if `pathname` lacks a locale prefix, return the path to
 * redirect to (default locale prepended); otherwise null (leave it alone).
 */
export function resolveLocaleRedirect(pathname: string): string | null {
  if (localeFromPathname(pathname)) {
    return null;
  }
  return withLocale(pathname, defaultLanguage);
}
