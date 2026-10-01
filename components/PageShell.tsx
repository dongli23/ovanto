import type { PageDefinition } from "../lib/content";
import { ROUTES } from "../lib/site";
import { GeneratorWorkbench } from "./GeneratorWorkbench";

const languageLinks = [
  { key: "en", label: "English", href: ROUTES.en },
  { key: "it", label: "Italiano", href: ROUTES.it },
  { key: "fr", label: "Français", href: ROUTES.fr },
  { key: "nl", label: "Nederlands", href: ROUTES.nl },
] as const;

const footerLabels: Record<PageDefinition["key"], Record<(typeof languageLinks)[number]["key"], string>> = {
  en: {
    en: "Free AI tools",
    it: "Generatore video AI gratis",
    fr: "Générateur de vidéo IA gratuit",
    nl: "AI afbeelding maken gratis",
  },
  it: {
    en: "Ovanto — free AI tools",
    it: "Generatore video AI gratis",
    fr: "Générateur de vidéo IA gratuit",
    nl: "AI afbeelding maken gratis",
  },
  fr: {
    en: "Ovanto — free AI tools",
    it: "Generatore video AI gratis",
    fr: "Générateur de vidéo IA gratuit",
    nl: "AI afbeelding maken gratis",
  },
  frGenerate: {
    en: "Ovanto — free AI tools",
    it: "Generatore video AI gratis",
    fr: "Générateur de vidéo IA gratuit",
    nl: "AI afbeelding maken gratis",
  },
  frEdit: {
    en: "Ovanto — free AI tools",
    it: "Generatore video AI gratis",
    fr: "Générateur de vidéo IA gratuit",
    nl: "AI afbeelding maken gratis",
  },
  nl: {
    en: "Ovanto — free AI tools",
    it: "Generatore video AI gratis",
    fr: "Générateur de vidéo IA gratuit",
    nl: "AI afbeelding maken gratis",
  },
  nlGenerate: {
    en: "Ovanto — free AI tools",
    it: "Generatore video AI gratis",
    fr: "Générateur de vidéo IA gratuit",
    nl: "AI afbeelding maken gratis",
  },
};

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
      <section className="content-section" aria-labelledby={`${page.key}-section-${index}`}>
        <h2 id={`${page.key}-section-${index}`}>{heading}</h2>
        <div className="faq-list">
          {page.faq.map((item) => (
            <article className="faq-item" key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
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

const toolsCopy: Record<
  PageDefinition["locale"],
  { label: string; summaryIntro: string; imageLink: string; editLink: string; videoLink: string }
> = {
  en: {
    label: "Tools",
    summaryIntro: "Choose the workflow that fits your idea:",
    imageLink: "create an AI image",
    editLink: "edit a photo with AI",
    videoLink: "create an AI video",
  },
  it: {
    label: "Strumenti",
    summaryIntro: "Scegli il flusso adatto alla tua idea:",
    imageLink: "crea un'immagine con l'AI",
    editLink: "modifica una foto con l'AI",
    videoLink: "crea un video con l'AI",
  },
  fr: {
    label: "Outils",
    summaryIntro: "Choisissez le parcours adapté à votre idée :",
    imageLink: "créez une image avec l'IA",
    editLink: "modifiez une photo avec l'IA",
    videoLink: "créez une vidéo avec l'IA",
  },
  nl: {
    label: "Hulpmiddelen",
    summaryIntro: "Kies de workflow die bij je idee past:",
    imageLink: "maak een AI-afbeelding",
    editLink: "bewerk een foto met AI",
    videoLink: "maak een AI-video",
  },
};

function ToolsLinks({ page }: { page: PageDefinition }) {
  const copy = toolsCopy[page.locale];

  return (
    <section className="tools-section" aria-label={copy.label}>
      <p className="tools-label">{copy.label}</p>
      <p className="tools-summary">
        {copy.summaryIntro} <a href={ROUTES.en}>{copy.imageLink}</a> ·{" "}
        <a href={ROUTES.frEdit}>{copy.editLink}</a> ·{" "}
        <a href={ROUTES.it}>{copy.videoLink}</a>.
      </p>
      {page.extraLinks && page.extraLinks.length > 0 ? (
        <nav className="context-links" aria-label="Related Ovanto tools">
          {page.extraLinks.map((link) => (
            <div key={link.href} data-latest-page={((page.key === "fr" || page.key === "nl") && link === page.extraLinks?.at(-1)) || undefined}>
              {(page.key === "fr" || page.key === "nl") && link === page.extraLinks?.at(-1) ? <span className="latest-label">{page.locale === "fr" ? "Dernière page" : "Nieuwste pagina"}</span> : null}
              <a className="context-link" href={link.href}>{link.label}</a>
            </div>
          ))}
        </nav>
      ) : null}
    </section>
  );
}

export function PageShell({ page }: { page: PageDefinition }) {
  const labels = footerLabels[page.key];
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <div className="site-shell">
      <header className="site-header">
        <span className="logo-mark" aria-label="Ovanto">
          <span className="logo-dot" aria-hidden="true" />
          <span>Ovanto</span>
        </span>
        <nav className="language-nav" aria-label="Language switcher">
          {languageLinks.map((link) => (
            <a
              href={link.href}
              key={link.key}
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
            <div className="trust-row" aria-label="Trust points">
              {page.trustPoints.map((trustPoint, index) => (
                <div className="trust-point" key={trustPoint}>
                  <span className="trust-icon" aria-hidden="true">0{index + 1}</span>
                  <span>{trustPoint}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="tool-wrap">
            <GeneratorWorkbench
              locale={page.locale}
              title={page.h1}
              valueLine={page.valueLine}
              mode={page.toolKind}
              turnstileSiteKey={turnstileSiteKey}
            />
          </div>
        </section>

        <ToolsLinks page={page} />

        <div className="content-wrap">
          {page.h2s.map((_, index) => (
            <SectionCopy key={page.h2s[index]} page={page} index={index} />
          ))}
          {(page.key === "en" || page.key === "it") ? <div data-latest-page-slot={page.locale} hidden /> : null}
        </div>
      </main>

      <footer className="site-footer">
        <div className="footer-row">
          <span>© {new Date().getFullYear()} Ovanto.ai</span>
          <nav className="footer-links" aria-label="Ovanto language pages">
            {languageLinks.map((link) => (
              <a href={link.href} key={link.key}>
                {labels[link.key]}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
