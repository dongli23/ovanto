import { NextRequest, NextResponse } from "next/server";
import { localeFromPath, TOOL_ROUTES, canonicalPath } from "./lib/site";

// Canonical public HTML routes (lib/site.ts TOOL_ROUTES). Bare forms get one
// 308 to the trailing-slash URL; API routes, metadata routes and static files
// never match this set.
const CANONICAL_HTML_PATHS: ReadonlySet<string> = new Set(
  Object.values(TOOL_ROUTES).flatMap((localeRoutes) => Object.values(localeRoutes)),
);

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;

  // Canonical URL policy: /path -> 308 -> /path/ for public HTML pages only.
  // Implemented here instead of next.config redirects()/trailingSlash, both
  // verified to misbehave on Next 16.3.8 (redirect self-loop / API redirect).
  if (!pathname.endsWith("/") && CANONICAL_HTML_PATHS.has(canonicalPath(pathname))) {
    // NB: assigning to nextUrl.pathname silently strips the trailing slash
    // (NextURL normalization), so build the target from strings instead.
    const target = new URL(`${canonicalPath(pathname)}${request.nextUrl.search}`, request.nextUrl.origin);
    return NextResponse.redirect(target, 308);
  }

  // This value is derived from the path on every request. The root layout uses
  // it only for the SSR html[lang] attribute; no redirect or cookie is involved.
  requestHeaders.set("x-ovanto-locale", localeFromPath(pathname));
  requestHeaders.set("x-ovanto-path", pathname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  // Preview deployments must not compete with the canonical www.ovanto.ai URLs.
  const hostname = request.nextUrl.hostname.toLowerCase();
  const isPreviewDeployment = process.env.VERCEL_ENV === "preview";
  if (isPreviewDeployment || hostname === "ovanto.vercel.app" || hostname.endsWith(".vercel.app")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|opengraph-image).*)"],
};
