import { PageShell } from "../../components/PageShell";
import { PAGE_CONTENT } from "../../lib/content";
import { faqJsonLd, metadataFor } from "../../lib/seo";

export const metadata = metadataFor(PAGE_CONTENT.enVideo);

export default function EnglishVideoPage() {
  const page = PAGE_CONTENT.enVideo;

  return (
    <>
      <PageShell page={page} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(page)) }}
      />
    </>
  );
}
