"use client";

import { useRouter } from "next/navigation";
import type { Language, WishlistEntityType } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { useAuth } from "@/components/providers/auth-provider";
import { useWishlist } from "@/components/providers/wishlist-provider";

interface Props {
  entityType: WishlistEntityType;
  entityId: number;
  lang: Language;
  /** Accessible label — the glyph carries no text. */
  label: string;
  className?: string;
}

/**
 * Floating wishlist toggle for detail pages. Positions itself over the media
 * frame, so the nearest positioned ancestor must be the image wrapper.
 */
export function WishlistButton({ entityType, entityId, lang, label, className }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { has, toggle } = useWishlist();
  const saved = has(entityType, entityId);

  const onWish = () => {
    if (!user) {
      router.push(`/${lang}/wishlist`);
      return;
    }
    toggle(entityType, entityId);
  };

  return (
    <button
      type="button"
      className={[
        "absolute top-2 inset-s-2 z-20 grid h-11 w-11 place-items-center rounded-full text-ink backdrop-blur-sm transition-all duration-200 hover:scale-105",
        saved ? "border-accent! bg-accent text-canvas" : "bg-surface/85 hover:bg-(--warm-soft)",
        className
      ].filter(Boolean).join(" ")}
      aria-label={label}
      onClick={onWish}
    >
      {saved ? <Icon.HeartFill size={20} /> : <Icon.Heart size={20} className="stroke-[2.4]" />}
    </button>
  );
}
