import { PageShell } from "../../components/PageShell";
import { PAGE_CONTENT } from "../../lib/content";
import { faqJsonLd, metadataFor } from "../../lib/seo";

export const metadata = metadataFor(PAGE_CONTENT.enEdit);

export default function EnglishPhotoEditPage() {
  const page = PAGE_CONTENT.enEdit;

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
