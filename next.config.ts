import type { NextConfig } from "next";

/**
 * Canonical public URLs always carry a trailing slash: /path -> 308 -> /path/.
 *
 * The native `trailingSlash: true` was verified locally on Next 16.3.8 and
 * rejected: it also 308-redirects /api/* routes, which would break payment
 * webhooks and explicit API clients. `skipTrailingSlashRedirect` therefore
 * stays on, and the bare->slash redirect is enforced precisely in proxy.ts
 * for the public HTML routes only — one hop, no double redirect, and API
 * routes, metadata routes (robots.txt, sitemap.xml) and static assets stay
 * untouched. Keep proxy.ts's route set in sync with lib/site.ts TOOL_ROUTES.
 */
const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
