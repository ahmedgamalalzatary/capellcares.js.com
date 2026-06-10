import { NextResponse, type NextRequest } from "next/server";

const locales = new Set(["ar", "en"]);
const defaultLocale = "ar";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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

export const config = { matcher: ["/((?!_next|api|favicon.ico|sitemap.xml|robots.txt).*)"] };
