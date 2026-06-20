"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";

/**
 * Fixed "back to top" button anchored to the bottom-start corner. Hidden until
 * the page is scrolled a screenful, then fades in; smooth-scrolls to the top.
 */
export function BackToTop({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-6 inset-s-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface text-ink shadow-(--shadow-2) transition-all duration-300 hover:-translate-y-0.5 hover:border-ink ${
        visible ? "pointer-events-auto opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <Icon.ArrowUp size={22} />
    </button>
  );
}
