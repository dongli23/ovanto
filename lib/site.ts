export const SITE_URL = "https://ovanto.ai";

export const ROUTES = {
  en: "/",
  it: "/it/",
  fr: "/fr/",
  nl: "/nl/",
  frGenerate: "/fr/photo-ia-gratuit",
  frEdit: "/fr/modifier-photo-ia",
  nlGenerate: "/nl/afbeeldingen-maken-met-ai",
} as const;

export const ABSOLUTE_ROUTES = {
  en: `${SITE_URL}${ROUTES.en}`,
  it: `${SITE_URL}${ROUTES.it}`,
  fr: `${SITE_URL}${ROUTES.fr}`,
  nl: `${SITE_URL}${ROUTES.nl}`,
  frGenerate: `${SITE_URL}${ROUTES.frGenerate}`,
  frEdit: `${SITE_URL}${ROUTES.frEdit}`,
  nlGenerate: `${SITE_URL}${ROUTES.nlGenerate}`,
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
