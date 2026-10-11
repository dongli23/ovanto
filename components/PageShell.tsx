import type { PageDefinition, ToolKind } from "../lib/content";
import { ROUTES, toolRoute, type Locale } from "../lib/site";
import { WORKSPACE_COPY } from "../lib/workspace-copy";
import { GeneratorWorkbench } from "./GeneratorWorkbench";
import { HomePlatform } from "./HomePlatform";

const languageLinks = [
  { key: "en", label: "English" },
  { key: "it", label: "Italiano" },
  { key: "fr", label: "Français" },
  { key: "nl", label: "Nederlands" },
] as const;

function languageHref(locale: Locale, currentToolKind: ToolKind): string {
  return toolRoute(locale, currentToolKind);
}

function SectionCopy({ page, index }: { page: PageDefinition; index: number }) {
  const heading = page.h2s[index];

  if (index === 0) {
    return (
      <section className="content-section" aria-labelledby={`${page.key}-section-${index}`}>
        <h2 id={`${page.key}-section-${index}`}>{heading}</h2>
        <p>{page.sectionLeads[0]}</p>
        {page.sectionDetails[0].map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
        <div className="step-grid">
          {page.steps.map((step, stepIndex) => (
            <div className="step-card" key={step}>
              <span className="step-number">0{stepIndex + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (index === 2) {
    return (
      <section className="content-section" aria-labelledby={`${page.key}-section-${index}`}>
        <h2 id={`${page.key}-section-${index}`}>{heading}</h2>
        <p>{page.sectionLeads[2]}</p>
        {page.sectionDetails[2].map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
        <div className="use-case-grid">
          {page.useCases.map((useCase, useCaseIndex) => (
            <article className="use-case-card" key={useCase}>
              <strong>{String(useCaseIndex + 1).padStart(2, "0")}</strong>
              <p>{useCase}</p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  if (index === 3) {
    return (
      <section className="content-section" id="faq" aria-labelledby={`${page.key}-section-${index}`}>
        <h2 id={`${page.key}-section-${index}`}>{heading}</h2>
        <div className="faq-list">
          {page.faq.map((item) => (
            <details className="faq-item" key={item.question}>
              <summary><h3>{item.question}</h3></summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="content-section" aria-labelledby={`${page.key}-section-${index}`}>
      <h2 id={`${page.key}-section-${index}`}>{heading}</h2>
      <p>{page.sectionLeads[1]}</p>
      {page.sectionDetails[1].map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
    </section>
  );
}

function ToolsLinks({ page }: { page: PageDefinition }) {
  const copy = WORKSPACE_COPY[page.locale].toolsLinks;
  const links = [
    { href: toolRoute(page.locale, "image"), label: copy.image },
    { href: toolRoute(page.locale, "edit"), label: copy.edit },
    { href: toolRoute(page.locale, "video"), label: copy.video },
  ];

  return (
    <section className="tools-section" aria-label={copy.label}>
      <p className="tools-label">{copy.label}</p>
      <p className="tools-summary">
        {copy.summaryIntro} {links.map((link, index) => (
          <span key={link.href}>
            {index > 0 ? " · " : null}
            <a href={link.href}>{link.label}</a>
          </span>
        ))}.
      </p>
      {page.extraLinks && page.extraLinks.length > 0 ? (
        <nav className="context-links" aria-label={copy.relatedAria}>
          {page.extraLinks.map((link) => (
            <a className="context-link" href={link.href} key={link.href}>{link.label}</a>
          ))}
        </nav>
      ) : null}
    </section>
  );
}

export function PageShell({ page }: { page: PageDefinition }) {
  const copy = WORKSPACE_COPY[page.locale];
  const footer = copy.footer;
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <div className="site-shell platform-home">
      <header className="site-header">
        <a className="logo-mark" href={ROUTES[page.locale]} aria-label={copy.header.logoAria}>
          <span className="logo-dot" aria-hidden="true" />
          <span>Ovanto</span>
        </a>
        <nav className="product-nav" aria-label={copy.header.productNavAria}>
          <a href={`${toolRoute(page.locale, "image")}#image-workbench`}>{copy.header.image}</a>
          <a href={toolRoute(page.locale, "video")}>{copy.header.video}</a>
          <a href={toolRoute(page.locale, "edit")}>{copy.header.edit}</a>
          <a href="#ai-tools">{copy.header.tools}</a>
          <a href="/pricing/">{copy.header.pricing}</a>
        </nav>
        <nav className="language-nav" aria-label={copy.header.languageNavAria}>
          {languageLinks.map((link) => (
            <a
              href={languageHref(link.key, page.toolKind)}
              key={link.key}
              hrefLang={link.key}
              aria-current={page.locale === link.key ? "page" : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <main>
        <section className={`hero${page.toolKind === "edit" ? " hero-edit" : ""}`} aria-labelledby={`${page.key}-title`}>
          <div className="hero-intro">
            <h1 id={`${page.key}-title`}>{page.h1}</h1>
            <p className="hero-subtitle">{page.valueLine}</p>
            <div className="trust-row">
              {page.trustPoints.map((trustPoint) => (
                <div className="trust-point" key={trustPoint}>
                  <span className="trust-icon" aria-hidden="true">✓</span>
                  <span>{trustPoint}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="tool-wrap" id="image-workbench">
            <GeneratorWorkbench
              locale={page.locale}
              title={page.h1}
              valueLine={page.valueLine}
              mode={page.toolKind}
              turnstileSiteKey={turnstileSiteKey}
            />
          </div>
        </section>

        <HomePlatform locale={page.locale} />
        <ToolsLinks page={page} />

        <div className="content-wrap">
          {page.h2s.map((_, index) => (
            <SectionCopy key={page.h2s[index]} page={page} index={index} />
          ))}
        </div>
      </main>

      <footer className="site-footer">
        <div className="platform-footer-grid">
          <div><a className="logo-mark" href={ROUTES[page.locale]} aria-label={copy.header.logoAria}><span className="logo-dot" aria-hidden="true" />Ovanto</a><p>{footer.description}</p></div>
          <nav aria-label={footer.toolsHeading}><h3>{footer.toolsHeading}</h3><a href={`${toolRoute(page.locale, "image")}#image-workbench`}>{footer.image}</a><a href={toolRoute(page.locale, "video")}>{footer.video}</a><a href={toolRoute(page.locale, "edit")}>{footer.edit}</a></nav>
          <nav aria-label={footer.resourcesHeading}><h3>{footer.resourcesHeading}</h3><a href="#inspiration">{footer.inspiration}</a><a href="#how-it-works">{footer.howItWorks}</a><a href="#faq">{footer.faq}</a></nav>
          <nav aria-label={footer.languageHeading}><h3>{footer.languageHeading}</h3>{languageLinks.map(link => <a href={languageHref(link.key, page.toolKind)} hrefLang={link.key} key={link.key}>{link.label}</a>)}</nav>
        </div>
        <div className="footer-row">
          <span>© {new Date().getFullYear()} Ovanto.ai</span>
          <nav className="footer-links" aria-label={footer.supportAria}>
            <a href="mailto:hello@ovanto.ai">{footer.support}</a>
            <a href="/pricing/">{footer.pricing}</a>
            <a href="/terms/#content-safety">{footer.contentSafety}</a>
            <a href="/terms/">{footer.terms}</a>
            <a href="/privacy/">{footer.privacy}</a>
          </nav>
          <nav className="footer-links" aria-label={footer.languagePagesAria}>
            {languageLinks.map((link) => (
              <a href={languageHref(link.key, page.toolKind)} hrefLang={link.key} key={link.key}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
