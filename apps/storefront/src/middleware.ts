import { NextResponse, type NextRequest } from "next/server";
import { defaultLanguage } from "@minikoshk/shared";
import { localeFromPathname, resolveLocaleRedirect } from "@/lib/locale";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Unprefixed paths (/, /shop, …) redirect to the default locale.
  const redirectPath = resolveLocaleRedirect(pathname);
  if (redirectPath) {
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    return NextResponse.redirect(url);
  }

  // Expose the active locale to the root layout so it can set <html lang/dir>
  // server-side (the root layout can't read the [lang] route param itself).
  const locale = localeFromPathname(pathname) ?? defaultLanguage;
  const headers = new Headers(request.headers);
  headers.set("x-locale", locale);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Run on everything except Next internals, API routes, and static files
  // (anything with a file extension, e.g. /_logo-1.png, /fonts/*.woff2).
  matcher: ["/((?!_next|api|.*\\..*).*)"]
};
