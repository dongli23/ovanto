export const SITE_URL = "https://www.ovanto.ai";

export const ROUTES = {
  en: "/",
  it: "/it/",
  fr: "/fr/",
  nl: "/nl/",
  frGenerate: "/fr/photo-ia-gratuit",
  frEdit: "/fr/modifier-photo-ia",
  nlGenerate: "/nl/afbeeldingen-maken-met-ai",
} as const;

export function canonicalPath(pathname: string): string {
  if (pathname === "/") return "/";
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${path.replace(/\/+$/, "")}/`;
}

export function canonicalUrl(pathname: string): string {
  return `${SITE_URL}${canonicalPath(pathname)}`;
}

export const ABSOLUTE_ROUTES = {
  en: canonicalUrl(ROUTES.en),
  it: canonicalUrl(ROUTES.it),
  fr: canonicalUrl(ROUTES.fr),
  nl: canonicalUrl(ROUTES.nl),
  frGenerate: canonicalUrl(ROUTES.frGenerate),
  frEdit: canonicalUrl(ROUTES.frEdit),
  nlGenerate: canonicalUrl(ROUTES.nlGenerate),
} as const;

export const SUPPORTED_LOCALES = ["en", "it", "fr", "nl"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function localeFromPath(pathname: string): Locale {
  if (pathname === "/it" || pathname.startsWith("/it/")) return "it";
  if (pathname === "/fr" || pathname.startsWith("/fr/")) return "fr";
  if (pathname === "/nl" || pathname.startsWith("/nl/")) return "nl";
  return "en";
}

export function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && SUPPORTED_LOCALES.includes(value as Locale));
}
