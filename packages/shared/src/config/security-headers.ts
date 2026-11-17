/** Response headers both Next apps (storefront and ERP) send on every route. nginx only terminates TLS and redirects HTTP to HTTPS, so the apps own these. No CSP here: both apps rely on inline scripts (theme boot, JSON-LD, Next runtime) and a CSP needs nonces to be safe without breaking them. */
export const webSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
];
