import { NextResponse, type NextRequest } from "next/server";

const locales = new Set(["ar", "en"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/ar", request.url));
  }

  const first = pathname.split("/")[1];
  if (!locales.has(first)) {
    return NextResponse.redirect(new URL(`/ar${pathname}`, request.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
