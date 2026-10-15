import { PageShell } from "../components/PageShell";
import { PAGE_CONTENT } from "../lib/content";
import { faqJsonLd, metadataFor, webApplicationJsonLd } from "../lib/seo";

// The English home route has no request-specific content. Keeping this route
// statically generated lets the CDN serve the complete shell without invoking
// the root layout for every anonymous visit. Other tool pages stay dynamic so
// their locale headers and request-scoped workspace state remain unchanged.
export const dynamic = "force-static";

export const metadata = metadataFor(PAGE_CONTENT.en);

export default function EnglishHomePage() {
  const page = PAGE_CONTENT.en;

  return (
    <>
      <PageShell page={page} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webApplicationJsonLd(page)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(page)) }}
      />
    </>
  );
}
