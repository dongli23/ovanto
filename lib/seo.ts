import type { Metadata } from "next";
import type { PageDefinition } from "./content";
import { SITE_URL } from "./site";

const OG_IMAGE_PATH = "/opengraph-image";

export function metadataFor(page: PageDefinition): Metadata {
  return {
    title: page.title,
    description: page.description,
    openGraph: {
      type: "website",
      title: page.title,
      description: page.description,
      siteName: "Ovanto",
      images: [
        {
          url: OG_IMAGE_PATH,
          width: 1200,
          height: 630,
          alt: "Ovanto AI creative tools",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [OG_IMAGE_PATH],
    },
    metadataBase: new URL(SITE_URL),
  };
}

export function faqJsonLd(page: PageDefinition) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: page.url,
    mainEntity: page.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function webApplicationJsonLd(page: PageDefinition) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Ovanto",
    url: page.url,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires a modern web browser",
    isAccessibleForFree: true,
    description: page.description,
  };
}
