const MESSAGES = [
  "Get 3 Zanooba for 1199 EGP",
  "Any 3 EVA Pieces for only 999 EGP",
  "2nd item -15% | 3rd item -30% | Free Shipping 800+ EGP | +15% with Card",
  "Get 3 Classics for 1199 EGP",
];

function Sparkle() {
  return <span aria-hidden className="px-1 text-amber-300">✨</span>;
}

/**
 * Top promo bar: a continuously scrolling marquee of offers on the navy
 * background, matching the ZEE storefront announcement strip.
 */
export function AnnouncementBar() {
  // Duplicate the list so the marquee loops seamlessly.
  const track = [...MESSAGES, ...MESSAGES];

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
