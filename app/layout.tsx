import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import { PAGE_CONTENT, type PageDefinition } from "../lib/content";
import { isLocale } from "../lib/site";

const manrope = localFont({
  src: "./fonts/ManropeLatin.woff2",
  variable: "--font-manrope",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ovanto.ai"),
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

function pageForPath(pathname: string): PageDefinition | undefined {
  const exact = Object.values(PAGE_CONTENT).find((page) => page.path === pathname);
  if (exact) return exact;

  // Next may serve a locale root without its mandated slash when a user types
  // that variant directly. Keep its SEO identity on the canonical slash URL.
  if (pathname === "/it" || pathname === "/fr" || pathname === "/nl") {
    return Object.values(PAGE_CONTENT).find((page) => page.path === `${pathname}/`);
  }

  return undefined;
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
          <link rel="canonical" href={page.url} />
          <link rel="alternate" hrefLang="en" href="https://ovanto.ai/" />
          <link rel="alternate" hrefLang="it" href="https://ovanto.ai/it/" />
          <link rel="alternate" hrefLang="fr" href="https://ovanto.ai/fr/" />
          <link rel="alternate" hrefLang="nl" href="https://ovanto.ai/nl/" />
          <link rel="alternate" hrefLang="x-default" href="https://ovanto.ai/" />
          <meta property="og:url" content={page.url} />
        </head>
      ) : null}
      <body className={`${manrope.variable} antialiased`}>{children}</body>
    </html>
  );
}
