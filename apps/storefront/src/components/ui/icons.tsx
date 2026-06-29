import type { CSSProperties } from "react";

type IconProps = { size?: number; className?: string; style?: CSSProperties };

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Icon = {
  // Cart glyph only. The item count is rendered as a separate HTML corner
  // badge by the header so it can never be clipped by the SVG viewBox.
  Cart: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M2.5 4.5h2.3l2 9.8a1.7 1.7 0 0 0 1.7 1.4h8a1.7 1.7 0 0 0 1.7-1.3L21.8 6" />
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </svg>
  ),
  Heart: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M12 20s-7-4.5-9.3-9C1.4 8.4 3.4 5 6.5 5c2 0 3.4 1 4.5 2.5h2C14 6 15.5 5 17.5 5c3.1 0 5.1 3.4 3.8 6-2.3 4.5-9.3 9-9.3 9z" />
    </svg>
  ),
  HeartFill: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
      <path d="M12 20s-7-4.5-9.3-9C1.4 8.4 3.4 5 6.5 5c2 0 3.4 1 4.5 2.5h2C14 6 15.5 5 17.5 5c3.1 0 5.1 3.4 3.8 6-2.3 4.5-9.3 9-9.3 9z" />
    </svg>
  ),
  User: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
    </svg>
  ),
  Search: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <circle cx="11" cy="11" r="6" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  ),
  Globe: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  ),
  Menu: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  Chevron: ({ size = 16, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  ArrowUp: ({ size = 22, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  ),
  Close: ({ size = 18, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  Check: ({ size = 16, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M5 12l4 4 10-10" />
    </svg>
  ),
  Plus: ({ size = 16, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Minus: ({ size = 16, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M5 12h14" />
    </svg>
  ),
  Trash: ({ size = 18, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    </svg>
  ),
  Shop: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={`icon-shop${className ? ` ${className}` : ""}`} style={style}>
      <style>{`.icon-shop line{transition:transform .25s ease,opacity .2s ease;transform-box:fill-box;transform-origin:center}.icon-shop:hover line:nth-of-type(1){transform:translateY(6px) rotate(45deg)}.icon-shop:hover line:nth-of-type(2){opacity:0}.icon-shop:hover line:nth-of-type(3){transform:translateY(-6px) rotate(-45deg)}`}</style>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  ),
  ColumnsOne: ({ size = 16, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  ),
  ColumnsTwo: ({ size = 16, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base} className={className} style={style}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  ),
  Visa: ({ className, style }: IconProps) => (
    <svg viewBox="0 0 48 16" className={className} style={style} role="img" aria-label="Visa">
      <text
        x="24"
        y="13"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="15"
        letterSpacing="0.5"
        fill="#1434CB"
      >
        VISA
      </text>
    </svg>
  ),
  Paymob: ({ className, style }: IconProps) => (
    <svg viewBox="0 0 56 16" className={className} style={style} role="img" aria-label="Paymob">
      <text x="0" y="13" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="14" fill="#0A2540">
        pay
      </text>
      <text x="24" y="13" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="14" fill="#16B364">
        mob
      </text>
    </svg>
  ),
  Mastercard: ({ className, style }: IconProps) => (
    <svg viewBox="0 0 40 24" className={className} style={style} role="img" aria-label="Mastercard">
      <circle cx="15" cy="12" r="10" fill="#EB001B" />
      <circle cx="25" cy="12" r="10" fill="#F79E1B" />
      <path
        d="M20 4.2a10 10 0 0 0 0 15.6 10 10 0 0 0 0-15.6z"
        fill="#FF5F00"
      />
    </svg>
  ),
  Apple: ({ size = 24, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden>
      <path d="M16.36 12.7c-.02-2.04 1.67-3.02 1.74-3.07-.95-1.39-2.43-1.58-2.96-1.6-1.26-.13-2.46.74-3.1.74-.64 0-1.62-.72-2.67-.7-1.37.02-2.64.8-3.35 2.03-1.43 2.48-.37 6.15 1.02 8.16.68.99 1.49 2.1 2.55 2.06 1.02-.04 1.41-.66 2.65-.66 1.23 0 1.58.66 2.66.64 1.1-.02 1.79-1 2.46-2 .78-1.15 1.1-2.26 1.12-2.32-.02-.01-2.15-.83-2.17-3.28zM14.6 6.4c.56-.68.94-1.62.83-2.56-.81.03-1.78.54-2.36 1.21-.52.6-.98 1.56-.86 2.48.9.07 1.83-.46 2.39-1.13z" />
    </svg>
  ),
  GooglePlay: ({ size = 20, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      <path d="M3.6 2.3c-.25.26-.4.66-.4 1.18v17.04c0 .52.15.92.4 1.18l.06.05L13.1 12.1v-.2L3.66 2.25l-.06.05z" fill="#00D3FF" />
      <path d="M16.25 15.25 13.1 12.1v-.2l3.16-3.16.07.04 3.74 2.13c1.07.6 1.07 1.6 0 2.21l-3.74 2.13-.08.04z" fill="#FFCE00" />
      <path d="M16.32 15.21 13.1 12 3.6 21.7c.35.37.93.42 1.59.05l11.13-6.54z" fill="#FF3D47" />
      <path d="M16.32 8.79 5.19 2.25c-.66-.37-1.24-.32-1.59.05L13.1 12l3.22-3.21z" fill="#00F076" />
    </svg>
  ),
  Logo: ({ size = 28, className, style }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} style={style} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#a13b4b" />
      <text x="20" y="26" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontSize="22" fill="#faf6f1">c</text>
    </svg>
  ),
  CashOnDelivery: ({ className, style }: IconProps) => (
    <svg viewBox="0 0 1200 1200" className={className} style={style} role="img" aria-label="Cash on Delivery" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(0,1200) scale(0.1,-0.1)" fill="#E8262A" stroke="none">
        <path d="M1358 8111 c-166 -53 -298 -200 -342 -381 -9 -36 -129 -810 -267 -1720 -245 -1614 -251 -1657 -240 -1729 28 -185 191 -356 381 -400 31 -7 1593 -11 4866 -11 4765 0 4823 0 4885 20 166 51 299 199 343 380 9 36 129 810 267 1720 245 1614 251 1657 240 1729 -28 185 -191 356 -381 400 -31 7 -1593 10 -4870 10 -4641 0 -4827 -1 -4882 -18z m7402 -230 c0 -4 -31 -180 -70 -390 -38 -209 -70 -398 -70 -418 0 -49 29 -95 81 -130 l43 -28 1199 -3 1199 -2 -6 -28 c-3 -15 -91 -592 -195 -1282 -105 -690 -197 -1275 -206 -1299 -15 -44 -55 -104 -85 -129 -8 -7 -33 -22 -55 -35 l-40 -22 -4432 -3 c-2438 -1 -4433 1 -4433 5 0 4 12 74 27 157 l27 149 -28 23 -27 24 -460 0 c-343 0 -459 3 -459 12 0 45 482 3182 495 3217 32 92 104 161 190 182 43 10 7305 11 7305 0z m1420 -11 c16 -16 20 -33 20 -90 0 -106 -6 -110 -178 -110 -178 0 -182 2 -182 107 0 113 0 113 177 113 130 0 145 -2 163 -20z m941 10 c17 -9 19 -22 19 -100 0 -78 -2 -91 -19 -100 -13 -6 -150 -10 -376 -10 -226 0 -363 4 -376 10 -17 9 -19 22 -19 100 0 74 3 91 18 99 24 14 727 15 753 1z" />
        <path d="M5775 7160 c-32 -6 -83 -17 -111 -25 -42 -12 -116 -15 -372 -15 -278 0 -323 -2 -336 -16 -20 -19 -20 -38 -3 -53 9 -7 123 -12 352 -13 309 -3 339 -4 349 -20 8 -13 8 -23 0 -35 -10 -17 -45 -18 -425 -23 -228 -3 -415 -7 -416 -8 -7 -6 -2 -52 6 -56 5 -4 206 -7 447 -8 413 -2 439 -3 457 -21 16 -16 17 -21 5 -38 -12 -17 -33 -19 -362 -24 -193 -3 -354 -9 -359 -14 -5 -5 -7 -19 -5 -32 l3 -24 245 -2 c235 -3 246 -4 262 -24 13 -16 15 -26 8 -40 -10 -18 -24 -19 -183 -19 -95 0 -178 -4 -185 -9 -8 -4 -12 -19 -10 -32 3 -22 9 -24 65 -29 l62 -5 31 -62 c56 -113 151 -172 384 -238 153 -44 193 -60 224 -88 31 -29 29 -77 -4 -108 -23 -22 -34 -24 -112 -23 -71 1 -104 8 -177 34 -127 46 -175 72 -305 168 -16 11 -27 -4 -120 -160 l-102 -173 34 -28 c55 -47 245 -134 353 -162 171 -44 395 -48 540 -10 99 26 204 83 266 145 97 97 135 201 127 352 -10 200 -107 288 -428 388 -74 24 -152 51 -172 61 -60 31 -76 81 -37 120 19 19 30 21 103 17 97 -6 200 -39 340 -108 55 -28 100 -49 101 -47 20 27 195 337 195 345 0 27 -204 112 -340 143 -99 22 -309 32 -395 19z" />
        <path d="M2784 7136 c-366 -95 -614 -405 -614 -767 l0 -69 -113 0 c-116 0 -137 -6 -137 -42 0 -33 34 -38 267 -38 165 0 232 -3 241 -12 16 -16 15 -45 0 -55 -7 -4 -152 -10 -323 -13 l-310 -5 0 -30 0 -30 408 -5 c424 -5 426 -5 427 -45 0 -32 -25 -35 -311 -35 -163 0 -299 -4 -313 -10 -28 -10 -35 -40 -13 -59 10 -7 133 -12 392 -13 347 -3 379 -4 389 -20 8 -13 8 -23 0 -35 -10 -16 -40 -18 -330 -23 l-319 -5 0 -30 0 -30 205 -5 c179 -4 213 -8 266 -27 136 -49 304 -54 454 -13 109 30 263 110 358 186 l82 66 -42 51 c-23 29 -76 93 -117 142 -41 50 -76 91 -77 93 -1 2 -27 -17 -58 -41 -129 -106 -290 -146 -390 -98 -60 30 -109 86 -136 157 -19 50 -21 73 -18 150 6 108 33 178 99 249 66 72 127 99 224 99 69 1 87 -3 135 -28 30 -16 82 -57 116 -92 l61 -62 146 155 c170 179 166 162 49 253 -83 64 -186 114 -287 140 -113 29 -289 27 -411 -4z" />
        <path d="M3811 6431 c-226 -385 -411 -702 -411 -705 0 -3 105 -6 233 -6 l233 0 53 100 52 100 269 0 269 0 7 -37 c3 -21 12 -65 18 -98 l12 -60 248 -3 248 -2 -4 22 c-3 13 -79 330 -169 705 l-164 683 -241 0 -242 0 -411 -699z m569 221 c0 -5 16 -94 35 -198 19 -104 35 -192 35 -196 0 -5 -65 -8 -145 -8 -103 0 -145 3 -145 12 0 6 46 98 103 204 91 172 117 214 117 186z" />
        <path d="M6805 7108 c-9 -40 -275 -1372 -275 -1380 0 -5 103 -8 229 -8 210 0 230 1 235 18 3 9 26 124 52 255 l47 237 222 0 223 0 -49 -237 c-27 -131 -49 -246 -49 -255 0 -17 18 -18 229 -18 l228 0 137 688 c75 378 139 695 142 705 5 16 -11 17 -228 17 l-234 0 -43 -222 c-24 -123 -47 -244 -53 -270 l-10 -48 -219 0 c-174 0 -219 3 -219 13 0 7 23 125 50 262 28 137 50 252 50 257 0 4 -103 8 -230 8 l-230 0 -5 -22z" />
        <path d="M2205 5519 c-121 -18 -220 -66 -299 -145 -150 -150 -188 -377 -94 -557 147 -277 612 -283 820 -10 68 90 90 157 96 283 3 88 1 115 -16 163 -42 118 -148 219 -267 252 -69 19 -168 25 -240 14z m150 -259 c102 -63 107 -257 9 -353 -65 -65 -150 -80 -217 -39 -50 32 -87 109 -87 182 0 168 169 287 295 210z" />
        <path d="M2910 5507 c0 -1 -38 -194 -85 -427 -47 -233 -85 -432 -85 -442 0 -17 10 -18 128 -16 l127 3 45 223 c25 122 47 222 50 222 3 0 63 -101 133 -225 l128 -225 120 0 c115 0 119 1 124 23 3 12 43 211 89 442 l83 420 -125 3 c-69 1 -128 -1 -132 -5 -4 -4 -26 -106 -50 -225 -24 -120 -46 -218 -49 -218 -3 0 -62 100 -131 223 l-125 222 -123 3 c-67 1 -122 1 -122 -1z" />
        <path d="M4085 5478 c-7 -21 -165 -828 -165 -843 0 -22 470 -22 555 0 156 41 277 132 339 257 44 87 59 162 54 263 -10 166 -103 275 -273 320 -78 20 -503 22 -510 3z m412 -232 c53 -27 76 -85 71 -177 -7 -112 -53 -185 -135 -215 -40 -14 -183 -19 -183 -6 0 4 19 101 42 216 l41 208 66 -4 c37 -3 81 -13 98 -22z" />
        <path d="M5035 5478 c-2 -7 -42 -203 -88 -436 l-84 -422 376 2 375 3 18 85 c9 47 17 95 18 108 l0 22 -226 0 -227 0 7 38 c3 20 6 43 6 49 0 10 52 13 207 15 l208 3 16 75 c8 41 18 90 22 108 l7 32 -205 0 c-113 0 -205 2 -205 5 0 2 5 27 11 54 l11 51 226 2 227 3 17 90 c9 50 17 98 18 108 0 16 -24 17 -365 17 -284 0 -367 -3 -370 -12z" />
        <path d="M5895 5478 c-2 -7 -42 -203 -88 -435 l-84 -423 327 0 327 0 22 108 c11 59 21 113 21 120 0 9 -43 12 -180 12 l-180 0 5 23 c3 12 32 154 64 315 l58 292 -144 0 c-106 0 -145 -3 -148 -12z" />
        <path d="M6541 5068 c-46 -233 -86 -429 -89 -435 -3 -10 29 -13 142 -13 143 0 146 0 151 23 13 54 165 823 165 834 0 10 -33 13 -143 13 l-142 0 -84 -422z" />
        <path d="M6976 5464 c4 -14 46 -209 94 -432 l87 -407 152 0 153 0 234 425 c128 234 233 428 234 433 0 4 -66 6 -146 5 l-146 -3 -129 -270 c-71 -148 -133 -273 -137 -277 -4 -4 -25 110 -46 255 -22 144 -41 270 -44 280 -4 15 -20 17 -158 17 l-154 0 6 -26z" />
        <path d="M7911 5078 c-45 -227 -85 -423 -88 -435 l-5 -23 376 0 376 0 4 23 c14 61 36 180 36 188 0 5 -102 9 -231 9 -215 0 -230 1 -225 18 2 9 7 32 11 49 l7 33 206 2 207 3 17 90 c9 50 17 98 18 108 0 16 -16 17 -200 17 -223 0 -211 -5 -189 73 l10 37 224 0 c124 0 225 2 225 4 0 2 9 48 20 101 11 53 20 101 20 106 0 5 -160 9 -369 9 l-368 0 -82 -412z" />
        <path d="M8771 5078 c-45 -227 -85 -423 -88 -435 l-5 -23 145 0 145 0 10 48 c6 26 16 75 23 110 l12 63 55 -3 55 -3 18 -65 c10 -36 23 -84 29 -107 l11 -43 163 0 163 0 -55 136 -56 137 30 21 c66 48 95 81 126 144 29 58 33 79 36 159 4 84 2 96 -22 140 -15 26 -44 60 -65 75 -69 49 -130 58 -402 58 l-246 0 -82 -412z m519 172 c26 -26 27 -94 0 -137 -13 -21 -31 -35 -57 -42 -47 -13 -173 -14 -173 -2 0 9 24 129 35 179 5 21 10 22 90 22 72 0 88 -3 105 -20z" />
        <path d="M9680 5486 c0 -2 47 -135 105 -296 58 -160 105 -304 105 -318 0 -25 -23 -176 -35 -229 l-5 -23 145 0 c142 0 145 0 150 23 3 12 13 72 23 132 l18 111 202 296 c111 163 202 299 202 302 0 3 -63 6 -140 6 l-140 0 -110 -165 c-61 -91 -112 -165 -114 -165 -2 0 -29 74 -61 165 l-59 165 -143 0 c-79 0 -143 -2 -143 -4z" />
      </g>
    </svg>
  )
};
