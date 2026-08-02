import localFont from "next/font/local";

// Neither family ships Arabic glyphs, so `ar` renders through the fallback list
// below via the browser's per-glyph fallback. Both locales get the identical
// stack — no locale branching — so Latin text on an Arabic page still uses the
// brand faces. The list is repeated in each call because next/font only accepts
// explicitly written literals (it reads these values at build time, not runtime).
//
// `adjustFontFallback` is off deliberately. Left on, next/font inserts a
// metric-matched `local("Arial")` face ahead of this list, which would route all
// Arabic to Arial's high-contrast naskh instead of Segoe UI. The CLS it buys for
// Latin isn't worth regressing the Arabic locale; `display: swap` plus preloaded
// ~10 KB woff2 files keeps the fallback window short either way.
//
// Chakra Petch tops out at Bold, but headings use `font-extrabold` (800) in ~18
// places. Declaring the Bold file across 700–900 makes those resolve to the real
// Bold outlines instead of the browser smearing a synthetic weight. Poppins is
// declared the same way so both families behave identically above 700.
export const chakraPetch = localFont({
  src: [
    { path: "../fonts/ChakraPetch-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ChakraPetch-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/ChakraPetch-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/ChakraPetch-Bold.woff2", weight: "700 900", style: "normal" }
  ],
  variable: "--font-chakra-petch",
  display: "swap",
  fallback: ["Segoe UI", "Tahoma", "Helvetica Neue", "Arial", "sans-serif"],
  adjustFontFallback: false
});

export const poppins = localFont({
  src: [
    { path: "../fonts/Poppins-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Poppins-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Poppins-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/Poppins-Bold.woff2", weight: "700 900", style: "normal" }
  ],
  variable: "--font-poppins",
  display: "swap",
  fallback: ["Segoe UI", "Tahoma", "Helvetica Neue", "Arial", "sans-serif"],
  adjustFontFallback: false
});
