import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import { PAGE_CONTENT, type PageDefinition } from "../lib/content";
import { canonicalPath, canonicalUrl, freeEditAlternates, isFreeEditPagePath, isLocale, SITE_URL, toolRoute } from "../lib/site";

const manrope = localFont({
  src: "./fonts/ManropeLatin.woff2",
  variable: "--font-manrope",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

function pageForPath(pathname: string): PageDefinition | undefined {
  const normalizedPath = canonicalPath(pathname);
  return Object.values(PAGE_CONTENT).find(
    (page) => canonicalPath(page.path) === normalizedPath,
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const headerLocale = requestHeaders.get("x-ovanto-locale");
  const locale = isLocale(headerLocale) ? headerLocale : "en";
  const page = pageForPath(requestHeaders.get("x-ovanto-path") ?? "/");

  return (
    <html lang={locale}>
      {page ? (
        <head>
          <link rel="canonical" href={canonicalUrl(page.path)} />
          {(isFreeEditPagePath(page.path)
            ? freeEditAlternates()
            : [
                { hrefLang: "en", href: canonicalUrl(toolRoute("en", page.toolKind)) },
                { hrefLang: "it", href: canonicalUrl(toolRoute("it", page.toolKind)) },
                { hrefLang: "fr", href: canonicalUrl(page.locale === "fr" ? page.path : toolRoute("fr", page.toolKind)) },
                { hrefLang: "nl", href: canonicalUrl(toolRoute("nl", page.toolKind)) },
                { hrefLang: "x-default", href: canonicalUrl(toolRoute("en", page.toolKind)) },
              ]
          ).map(({ hrefLang, href }) => (
            <link key={hrefLang} rel="alternate" hrefLang={hrefLang} href={href} />
          ))}
          <meta property="og:url" content={canonicalUrl(page.path)} />
        </head>
      ) : null}
      <body className={`${manrope.variable} antialiased`}>{children}</body>
    </html>
  );
}
