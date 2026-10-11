export const SITE_URL = "https://www.ovanto.ai";

export const ROUTES = {
  en: "/",
  enVideo: "/video/",
  enEdit: "/edit/",
  it: "/it/",
  itImage: "/it/immagini-ai/",
  itEdit: "/it/modifica-foto-ai/",
  fr: "/fr/",
  nl: "/nl/",
  nlVideo: "/nl/ai-video-maken/",
  nlEdit: "/nl/foto-bewerken-ai/",
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
  enVideo: canonicalUrl(ROUTES.enVideo),
  enEdit: canonicalUrl(ROUTES.enEdit),
  it: canonicalUrl(ROUTES.it),
  itImage: canonicalUrl(ROUTES.itImage),
  itEdit: canonicalUrl(ROUTES.itEdit),
  fr: canonicalUrl(ROUTES.fr),
  nl: canonicalUrl(ROUTES.nl),
  nlVideo: canonicalUrl(ROUTES.nlVideo),
  nlEdit: canonicalUrl(ROUTES.nlEdit),
  frGenerate: canonicalUrl(ROUTES.frGenerate),
  frEdit: canonicalUrl(ROUTES.frEdit),
  nlGenerate: canonicalUrl(ROUTES.nlGenerate),
} as const;

export const SUPPORTED_LOCALES = ["en", "it", "fr", "nl"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type ToolKind = "image" | "video" | "edit";

/** The canonical public path for every supported locale and creative workflow. */
export const TOOL_ROUTES = {
  en: {
    image: ROUTES.en,
    video: ROUTES.enVideo,
    edit: ROUTES.enEdit,
  },
  it: {
    image: ROUTES.itImage,
    video: ROUTES.it,
    edit: ROUTES.itEdit,
  },
  fr: {
    image: ROUTES.frGenerate,
    video: ROUTES.fr,
    edit: ROUTES.frEdit,
  },
  nl: {
    image: ROUTES.nl,
    video: ROUTES.nlVideo,
    edit: ROUTES.nlEdit,
  },
} as const satisfies Record<Locale, Record<ToolKind, string>>;

export function toolRoute(locale: Locale, toolKind: ToolKind): string {
  return TOOL_ROUTES[locale][toolKind];
}

export function localeFromPath(pathname: string): Locale {
  if (pathname === "/it" || pathname.startsWith("/it/")) return "it";
  if (pathname === "/fr" || pathname.startsWith("/fr/")) return "fr";
  if (pathname === "/nl" || pathname.startsWith("/nl/")) return "nl";
  return "en";
}

export function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && SUPPORTED_LOCALES.includes(value as Locale));
}
