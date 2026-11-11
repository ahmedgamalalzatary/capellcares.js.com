import { NextResponse, type NextRequest } from "next/server";
import { defaultLanguage } from "@capella/shared";

// Lives in src/ because the app does: Next.js only runs a proxy placed next to the app folder. It sets x-capella-locale, which the root layout reads for <html lang/dir>.
const locales = new Set(["ar", "en"]);
const defaultLocale = defaultLanguage;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/checkout/payment-result") {
    return NextResponse.next();
  }
  if (pathname === "/") {
    return NextResponse.redirect(new URL(`/${defaultLocale}`, request.url));
  }

  const first = pathname.split("/")[1];
  if (!locales.has(first)) {
    return NextResponse.redirect(new URL(`/${defaultLocale}${pathname}`, request.url));
  }

  const headers = new Headers(request.headers);
  headers.set("x-capella-locale", first);
  return NextResponse.next({
    request: {
      headers
    }
  });
}

// Files with an extension (public/ images, icons, robots.txt, sitemap.xml) are served as they are, never redirected to a language.
export const config = { matcher: ["/((?!_next|api|.*\\..*).*)"] };
