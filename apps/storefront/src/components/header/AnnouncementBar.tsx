"use client";

import { useLocale } from "../i18n/LocaleProvider";

function Sparkle() {
  return <span aria-hidden className="px-1 text-white">✨</span>;
}

/**
 * Top promo bar: a continuously scrolling marquee of offers on the navy
 * background, matching the Minikoshk storefront announcement strip.
 */
export function AnnouncementBar() {
  const { dict } = useLocale();
  // Duplicate the list so the marquee loops seamlessly.
  const track = [...dict.header.announcements, ...dict.header.announcements];

  return (
    <div className="overflow-hidden bg-navy-dark text-white">
      <div className="animate-marquee flex w-max whitespace-nowrap py-2 text-xs font-medium tracking-wide">
        {track.map((msg, i) => (
          <span key={i} className="flex items-center px-8">
            {msg}
            <Sparkle />
          </span>
        ))}
      </div>
    </div>
  );
}
