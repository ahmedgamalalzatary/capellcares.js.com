import type { ReactNode } from "react";

// Root layout is intentionally minimal — the [lang] layout owns <html>/<body>
// so we can set lang and dir per locale.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children as any;
}
