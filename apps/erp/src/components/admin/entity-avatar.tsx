interface Props {
  /** Image URL for the entity. When empty/null, the letter fallback is shown. */
  src?: string | null;
  /** Letter (or short text) shown when no image is available. */
  fallback: string;
  /** Use the wider tile shape (offers list). */
  wide?: boolean;
}

export function EntityAvatar({ src, fallback, wide }: Props) {
  const className = wide ? "avatar-tile avatar-tile--wide" : "avatar-tile";

  if (src) {
    return <img src={src} alt="" className={className} />;
  }

  return <div className={className}>{fallback}</div>;
}
