import { API_BASE } from "@/lib/api/client";

interface Props {
  /** Image URL for the entity. When empty/null, the letter fallback is shown. */
  src?: string | null;
  /** Letter (or short text) shown when no image is available. */
  fallback: string;
  /** Use the wider tile shape (offers list). */
  wide?: boolean;
}

/** Stored media may be a relative `/uploads/...` path, which must resolve against
 * the API origin rather than the ERP origin. */
function resolveAvatarSrc(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith("/uploads/")) {
    return `${API_BASE}${value}`;
  }

  return value;
}

export function EntityAvatar({ src, fallback, wide }: Props) {
  const className = wide ? "avatar-tile avatar-tile--wide" : "avatar-tile";

  if (src) {
    return <img src={resolveAvatarSrc(src)} alt="" className={className} />;
  }

  return <div className={className}>{fallback}</div>;
}
