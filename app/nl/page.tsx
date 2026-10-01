import { PageShell } from "../../components/PageShell";
import { PAGE_CONTENT } from "../../lib/content";
import { faqJsonLd, metadataFor, webApplicationJsonLd } from "../../lib/seo";

export const metadata = metadataFor(PAGE_CONTENT.nl);

export default function DutchHomePage() {
  const page = PAGE_CONTENT.nl;

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
