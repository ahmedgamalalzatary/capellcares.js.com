import type { ButtonHTMLAttributes } from "react";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** The storefront's one previous/next arrow: a bare black chevron with a soft light halo, used by every carousel, card row and pill strip.
 * The "light" tone (white with a dark halo) is only for the Capella Advices video row.
 * Callers only place it (`className`); look, size and behaviour live here. Disabled arrows vanish so a row's ends read as ends. */
export function NavArrow({
  direction,
  isRtl,
  show = "lg",
  tone = "dark",
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "type"> & {
  direction: "prev" | "next";
  isRtl: boolean;
  /** "lg" (default): desktop only — phones and tablets swipe instead. "always": every screen size, e.g. the full-screen preview. */
  show?: "lg" | "always";
  /** "dark" (default): black, the whole site. "light": white, the Capella Advices videos only. */
  tone?: "dark" | "light";
}) {
  // The chevron points right; it flips whenever the arrow should point left (prev in LTR, next in RTL).
  const pointsLeft = (direction === "prev") !== isRtl;
  return (
    <button
      type="button"
      {...props}
      className={cn(
        show === "always" ? "grid" : "hidden lg:grid",
        "size-12 shrink-0 place-items-center transition hover:scale-110 disabled:pointer-events-none disabled:opacity-0",
        tone === "light"
          ? "text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]"
          : "text-black drop-shadow-[0_1px_4px_rgba(255,255,255,0.45)]",
        className
      )}
    >
      <Icon.Chevron size={30} style={{ strokeWidth: 2.6 }} className={pointsLeft ? "rotate-180" : undefined} />
    </button>
  );
}
