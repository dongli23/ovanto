import { NextRequest, NextResponse } from "next/server";
import { localeFromPath } from "./lib/site";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;

  // This value is derived from the path on every request. The root layout uses
  // it only for the SSR html[lang] attribute; no redirect or cookie is involved.
  requestHeaders.set("x-ovanto-locale", localeFromPath(pathname));
  requestHeaders.set("x-ovanto-path", pathname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  // Preview deployments must not compete with the unchanged ovanto.ai canonicals.
  const hostname = request.nextUrl.hostname.toLowerCase();
  if (hostname === "ovanto.vercel.app" || hostname.endsWith(".vercel.app")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|opengraph-image).*)"],
};
