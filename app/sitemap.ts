import type { MetadataRoute } from "next";
import { canonicalUrl, ROUTES } from "../lib/site";

const PUBLIC_ROUTES = [
  ROUTES.en,
  ROUTES.it,
  ROUTES.fr,
  ROUTES.frGenerate,
  ROUTES.frEdit,
  ROUTES.nl,
  ROUTES.nlGenerate,
  "/terms/",
  "/privacy/",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((pathname) => ({
    url: canonicalUrl(pathname),
  }));
}
