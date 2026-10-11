import { PageShell } from "../../../components/PageShell";
import { PAGE_CONTENT } from "../../../lib/content";
import { faqJsonLd, metadataFor } from "../../../lib/seo";

export const metadata = metadataFor(PAGE_CONTENT.itEdit);

export default function ItalianPhotoEditPage() {
  const page = PAGE_CONTENT.itEdit;

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
