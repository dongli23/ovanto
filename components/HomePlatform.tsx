import Image from "next/image";
import { toolRoute, type Locale, type ToolKind } from "../lib/site";
import { BENEFIT_ICONS, WORKSPACE_COPY } from "../lib/workspace-copy";

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div className="platform-heading"><p className="platform-eyebrow">{eyebrow}</p><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>;
}

const toolImages: Record<ToolKind, string> = {
  image: "/examples/avatar.webp",
  video: "/examples/landscape.webp",
  edit: "/examples/sneaker.webp",
};

const inspirationImages = [
  "/examples/avatar.webp",
  "/examples/sneaker.webp",
  "/examples/poster.svg",
  "/examples/interior.svg",
  "/examples/landscape.webp",
  "/examples/botanical.svg",
] as const;

export function HomePlatform({ locale }: { locale: Locale }) {
  const copy = WORKSPACE_COPY[locale].platform;
  const imageHref = `${toolRoute(locale, "image")}#image-workbench`;

  return <div className="platform-sections">
    <section id="ai-tools" className="platform-section" aria-label={copy.aria.tools}>
      <SectionHeading eyebrow={copy.tools.eyebrow} title={copy.tools.title} description={copy.tools.description} />
      <div className="platform-tool-grid">{copy.tools.cards.map((tool) => <a className="platform-tool" href={tool.kind === "image" ? imageHref : toolRoute(locale, tool.kind)} key={tool.kind}>
        <div className="platform-tool-image"><Image src={toolImages[tool.kind]} width={960} height={720} alt={tool.title} sizes="(max-width: 760px) 100vw, 33vw" loading="lazy" /><span>{copy.tools.explore} <span aria-hidden="true">↗</span></span></div>
        <div className="platform-tool-copy"><h3>{tool.title}</h3><p>{tool.description}</p><small>{tool.note}</small></div>
      </a>)}</div>
      <p className="platform-note">{copy.tools.note}</p>
    </section>
    <section id="ai-models" className="platform-section platform-model-section" aria-label={copy.aria.models}>
      <SectionHeading eyebrow={copy.models.eyebrow} title={copy.models.title} description={copy.models.description} />
      <div><article className="platform-model">
        <div className="model-monogram" aria-hidden="true">F<span>↗</span></div><div><span className="platform-status">{copy.models.status}</span><h3>Flux Schnell</h3><p>{copy.models.modelDescription}</p><small>{copy.models.details}</small><a href={imageHref}>{copy.models.cta} <span aria-hidden="true">→</span></a></div>
      </article></div>
    </section>
    <section id="inspiration" className="platform-section" aria-label={copy.aria.inspiration}>
      <SectionHeading eyebrow={copy.inspiration.eyebrow} title={copy.inspiration.title} description={copy.inspiration.description} />
      <div className="inspiration-grid">{copy.inspiration.items.map((item, index) => <figure className="inspiration-card" key={item.name}>
        <Image src={inspirationImages[index]} width={960} height={720} alt={item.alt} sizes="(max-width: 560px) 100vw, (max-width: 900px) 50vw, 33vw" loading="lazy" />
        <figcaption><strong>{item.name}</strong><span>{item.detail}</span></figcaption>
      </figure>)}</div>
    </section>
    <section id="core-benefits" className="platform-section" aria-label={copy.aria.benefits}>
      <SectionHeading eyebrow={copy.benefits.eyebrow} title={copy.benefits.title} />
      <div className="benefit-grid">{copy.benefits.items.map((benefit, index) => <article className="benefit" key={benefit.title}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={BENEFIT_ICONS[index]}/></svg><h3>{benefit.title}</h3><p>{benefit.text}</p></article>)}</div>
    </section>
    <section id="how-it-works" className="platform-section" aria-label={copy.aria.process}>
      <SectionHeading eyebrow={copy.process.eyebrow} title={copy.process.title} />
      <ol className="platform-process">{copy.process.steps.map((step, index) => <li key={step.title}><span className="process-number">0{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
    </section>
    <section id="advanced-features" className="platform-section" aria-label={copy.aria.features}>
      <SectionHeading eyebrow={copy.features.eyebrow} title={copy.features.title} />
      <div className="platform-feature"><div><span className="platform-status">{copy.features.promptStatus}</span><h3>{copy.features.promptTitle}</h3><p>{copy.features.promptDescription}</p><a href={imageHref}>{copy.features.promptCta} <span aria-hidden="true">→</span></a></div>
        <div className="prompt-demonstration" aria-label={copy.aria.promptPreview}><span>{copy.features.promptPreviewLabel}</span><p>{copy.features.promptText}</p><div className="prompt-structure">{copy.features.promptTags.map((tag) => <span key={tag}>{tag}</span>)}</div><small>{copy.features.promptNote}</small></div>
      </div>
      <div className="platform-feature platform-feature-reverse"><div><span className="platform-status">{copy.features.workflowStatus}</span><h3>{copy.features.workflowTitle}</h3><p>{copy.features.workflowDescription}</p><a href={imageHref}>{copy.features.workflowCta} <span aria-hidden="true">→</span></a></div>
        <figure className="workflow-demonstration"><Image src="/examples/landscape.webp" width={960} height={720} alt={copy.features.workflowAlt} sizes="(max-width: 760px) 100vw, 45vw" loading="lazy" /><figcaption>{copy.features.workflowCaption}</figcaption></figure>
      </div>
    </section>
  </div>;
}
