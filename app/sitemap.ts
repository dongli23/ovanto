import type { MetadataRoute } from "next";
import { PUBLIC_HTML_ROUTES, canonicalUrl } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_HTML_ROUTES.map((pathname) => ({
    url: canonicalUrl(pathname),
  }));
}
