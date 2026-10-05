import type { Language } from "@capella/shared";
import { resolvePublicEntityMediaUrl } from "../entity-media/entity-media.repository.js";

// A hover image is either a root-relative upload path or an http(s) URL; anything else
// (bare ids, other schemes, whitespace, control characters) would surface broken
// rendering on the storefront — Next Image rejects protocol-relative and malformed URLs.
const CONTROL_CHARS_PATTERN = /[\u0000-\u001f\u007f]/;
const HTTP_URL_PREFIX_PATTERN = /^https?:\/\//i;
const RELATIVE_PATH_PATTERN = /^\/(?!\/)\S*$/;

function isValidHoverImageSource(raw: string) {
  if (CONTROL_CHARS_PATTERN.test(raw)) return false;
  if (HTTP_URL_PREFIX_PATTERN.test(raw)) {
    // Relative paths already reject whitespace via the path pattern; keep http(s) URLs
    // consistent instead of letting `new URL` silently percent-encode spaces.
    if (/\s/.test(raw)) return false;
    try {
      const parsed = new URL(raw);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }
  return RELATIVE_PATH_PATTERN.test(raw);
}

function assertValidHoverImageValue(key: string, raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  // An empty string clears the image, same as null.
  if (typeof raw !== "string" || raw.length > 1024 || (raw !== "" && !isValidHoverImageSource(raw))) {
    throw invalidHoverImage(key);
  }
  return raw;
}

function invalidHoverImage(key: string) {
  // The raw value is deliberately omitted: coercing it can itself throw (e.g. an object
  // whose toString is not a function returning a string) and turn a 400 into a 500.
  const error = new Error(`Invalid hover image value for ${key}`) as Error & { code?: string };
  error.code = "INVALID_HOVER_IMAGE";
  return error;
}

function resolveHoverImagePath(hoverImagePath: string | null | undefined) {
  return hoverImagePath ? resolvePublicEntityMediaUrl(hoverImagePath) : null;
}

export function resolveLocalizedHoverImagePath(
  arHoverImagePath: string | null | undefined,
  enHoverImagePath: string | null | undefined,
  lang: Language
) {
  const path = lang === "ar"
    ? arHoverImagePath || enHoverImagePath
    : enHoverImagePath || arHoverImagePath;
  return resolveHoverImagePath(path);
}

/** The hover-image triplet an entity row resolves to: `hoverImagePath` follows the requested language, while the localized fields keep their own language. */
export function resolveHoverImageFields(
  arHoverImagePath: string | null | undefined,
  enHoverImagePath: string | null | undefined,
  lang: Language
) {
  return {
    hoverImagePath: resolveLocalizedHoverImagePath(arHoverImagePath, enHoverImagePath, lang) ?? "",
    arHoverImagePath: resolveHoverImagePath(arHoverImagePath),
    enHoverImagePath: resolveHoverImagePath(enHoverImagePath)
  };
}

/** Derives the hover-image column writes from a localized payload: an explicit `enHoverImagePath: null` must clear the English column, while a legacy `hoverImagePath` value seeds it only when the explicit field is absent. */
export function resolveHoverImageUpdate(input: {
  hoverImagePath?: string | null;
  arHoverImagePath?: string | null;
  enHoverImagePath?: string | null;
}) {
  const hasEnHoverUpdate = input.enHoverImagePath !== undefined || input.hoverImagePath !== undefined;
  const enHoverImagePath = input.enHoverImagePath !== undefined
    ? input.enHoverImagePath
    : input.hoverImagePath ?? null;
  const hasArHoverUpdate = input.arHoverImagePath !== undefined;
  return {
    hasEnHoverUpdate,
    enHoverImagePath,
    hasArHoverUpdate,
    arHoverImagePath: input.arHoverImagePath ?? null
  };
}

/** Parses an admin upsert body into hover-image repo input; keys the admin omitted stay undefined so a partial edit leaves the stored image untouched. Values must be a valid image path/URL, null (explicit clear), or absent. */
export function parseHoverImageInput(incoming: Record<string, unknown>) {
  const has = (key: string) => Object.prototype.hasOwnProperty.call(incoming, key);
  const value = (key: string) => assertValidHoverImageValue(key, incoming[key]);
  return {
    hoverImagePath: has("hoverImagePath") ? value("hoverImagePath") : undefined,
    arHoverImagePath: has("arHoverImagePath") ? value("arHoverImagePath") : undefined,
    enHoverImagePath: has("enHoverImagePath") ? value("enHoverImagePath") : undefined
  };
}
