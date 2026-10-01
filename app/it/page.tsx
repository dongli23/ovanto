import { PageShell } from "../../components/PageShell";
import { PAGE_CONTENT } from "../../lib/content";
import { faqJsonLd, metadataFor, webApplicationJsonLd } from "../../lib/seo";

export const metadata = metadataFor(PAGE_CONTENT.it);

export default function ItalianHomePage() {
  const page = PAGE_CONTENT.it;

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
