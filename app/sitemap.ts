import type { MetadataRoute } from "next";
import { canonicalUrl, ROUTES, TOOL_ROUTES } from "../lib/site";

const PUBLIC_ROUTES = [
  ...Object.values(TOOL_ROUTES).flatMap((localeRoutes) => Object.values(localeRoutes)),
  // Keep the existing Dutch image landing page discoverable alongside the locale matrix.
  ROUTES.nlGenerate,
  "/pricing/",
  "/terms/",
  "/privacy/",
].filter((pathname, index, routes) => routes.indexOf(pathname) === index);

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((pathname) => ({
    url: canonicalUrl(pathname),
  }));
}
