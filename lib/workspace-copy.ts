import type { Locale, ToolKind } from "./site";

export type WorkspacePromptExample = {
  label: string;
  prompt: string;
};

export type PlatformToolCopy = {
  kind: ToolKind;
  title: string;
  description: string;
  note: string;
};

export type PlatformInspirationCopy = {
  name: string;
  detail: string;
  alt: string;
};

export type PlatformBenefitCopy = {
  title: string;
  text: string;
};

export type HomePlatformCopy = {
  aria: {
    tools: string;
    models: string;
    inspiration: string;
    benefits: string;
    process: string;
    features: string;
    promptPreview: string;
  };
  tools: {
    eyebrow: string;
    title: string;
    description: string;
    explore: string;
    cards: readonly PlatformToolCopy[];
    note: string;
  };
  models: {
    eyebrow: string;
    title: string;
    description: string;
    status: string;
    modelDescription: string;
    details: string;
    cta: string;
  };
  inspiration: {
    eyebrow: string;
    title: string;
    description: string;
    items: readonly PlatformInspirationCopy[];
  };
  benefits: {
    eyebrow: string;
    title: string;
    items: readonly PlatformBenefitCopy[];
  };
  process: {
    eyebrow: string;
    title: string;
    steps: readonly { title: string; text: string }[];
  };
  features: {
    eyebrow: string;
    title: string;
    promptStatus: string;
    promptTitle: string;
    promptDescription: string;
    promptCta: string;
    promptPreviewLabel: string;
    promptText: string;
    promptTags: readonly string[];
    promptNote: string;
    workflowStatus: string;
    workflowTitle: string;
    workflowDescription: string;
    workflowCta: string;
    workflowAlt: string;
    workflowCaption: string;
  };
};

export type WorkspaceCopy = {
  header: {
    logoAria: string;
    productNavAria: string;
    image: string;
    video: string;
    edit: string;
    tools: string;
    pricing: string;
    languageNavAria: string;
  };
  workbench: {
    modeNavAria: string;
    modes: Record<ToolKind, string>;
    actions: Record<ToolKind, string>;
    examples: Record<ToolKind, readonly WorkspacePromptExample[]>;
  };
  toolsLinks: {
    label: string;
    summaryIntro: string;
    image: string;
    edit: string;
    video: string;
    relatedAria: string;
  };
  footer: {
    description: string;
    toolsHeading: string;
    resourcesHeading: string;
    languageHeading: string;
    image: string;
    video: string;
    edit: string;
    inspiration: string;
    howItWorks: string;
    faq: string;
    supportAria: string;
    support: string;
    pricing: string;
    contentSafety: string;
    terms: string;
    privacy: string;
    languagePagesAria: string;
  };
  platform: HomePlatformCopy;
};

const benefitIcons = [
  "M8 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M14 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M3 10l2 2 4-4",
  "m14 3-9 11h7l-2 7 9-11h-7l2-7Z",
  "M4 7h16M4 17h16M8 4v6M16 14v6",
  "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3ZM8 12l3 3 5-6",
  "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM17 14l3 6h-6l3-6Z",
  "M4 4h16v16H4zM4 9h16M7 6.5h.1M10 6.5h.1M9 14l-2 2 2 2M15 14l2 2-2 2",
] as const;

export const BENEFIT_ICONS = benefitIcons;

const enInspiration: readonly PlatformInspirationCopy[] = [
  { name: "Portrait", detail: "Character, expression, color", alt: "Colorful illustrated character portrait" },
  { name: "Product", detail: "Object, surface, light", alt: "Illustration of a white sneaker on a stone surface" },
  { name: "Poster", detail: "Shape, balance, contrast", alt: "Original abstract poster concept with coral and mint geometric shapes" },
  { name: "Interior", detail: "Space, materials, atmosphere", alt: "Original line illustration of a calm room with a chair and a large window" },
  { name: "Landscape", detail: "Place, season, time of day", alt: "Illustrated mountain landscape under a blue evening sky" },
  { name: "Illustration", detail: "A subject with a visual style", alt: "Original botanical illustration with mint leaves and a coral sun" },
];

const itInspiration: readonly PlatformInspirationCopy[] = [
  { name: "Ritratto", detail: "Personaggio, espressione, colore", alt: "Ritratto illustrato di un personaggio dai colori vivaci" },
  { name: "Prodotto", detail: "Oggetto, superficie, luce", alt: "Illustrazione di una scarpa bianca su una superficie in pietra" },
  { name: "Poster", detail: "Forma, equilibrio, contrasto", alt: "Concept di poster astratto con forme corallo e menta" },
  { name: "Interni", detail: "Spazio, materiali, atmosfera", alt: "Illustrazione lineare di una stanza calma con una sedia e una grande finestra" },
  { name: "Paesaggio", detail: "Luogo, stagione, momento della giornata", alt: "Paesaggio montano illustrato sotto un cielo blu della sera" },
  { name: "Illustrazione", detail: "Un soggetto con uno stile visivo", alt: "Illustrazione botanica originale con foglie menta e un sole corallo" },
];

const frInspiration: readonly PlatformInspirationCopy[] = [
  { name: "Portrait", detail: "Personnage, expression, couleur", alt: "Portrait illustré d'un personnage aux couleurs vives" },
  { name: "Produit", detail: "Objet, surface, lumière", alt: "Illustration d'une chaussure blanche sur une surface en pierre" },
  { name: "Affiche", detail: "Forme, équilibre, contraste", alt: "Concept d'affiche abstraite avec des formes corail et menthe" },
  { name: "Intérieur", detail: "Espace, matières, atmosphère", alt: "Illustration au trait d'une pièce calme avec une chaise et une grande fenêtre" },
  { name: "Paysage", detail: "Lieu, saison, moment de la journée", alt: "Paysage de montagne illustré sous un ciel bleu du soir" },
  { name: "Illustration", detail: "Un sujet avec un style visuel", alt: "Illustration botanique originale avec des feuilles menthe et un soleil corail" },
];

const nlInspiration: readonly PlatformInspirationCopy[] = [
  { name: "Portret", detail: "Personage, expressie, kleur", alt: "Kleurrijk geïllustreerd portret van een personage" },
  { name: "Product", detail: "Object, oppervlak, licht", alt: "Illustratie van een witte sneaker op een stenen oppervlak" },
  { name: "Poster", detail: "Vorm, balans, contrast", alt: "Origineel abstract posterconcept met koraal en mintgroene vormen" },
  { name: "Interieur", detail: "Ruimte, materialen, sfeer", alt: "Originele lijnillustratie van een rustige kamer met een stoel en groot raam" },
  { name: "Landschap", detail: "Plaats, seizoen, moment van de dag", alt: "Geïllustreerd berglandschap onder een blauwe avondlucht" },
  { name: "Illustratie", detail: "Een onderwerp met een visuele stijl", alt: "Originele botanische illustratie met mintgroene bladeren en een koraalkleurige zon" },
];

const enPlatform: HomePlatformCopy = {
  aria: { tools: "AI tools", models: "Available AI models", inspiration: "Inspiration", benefits: "Core benefits", process: "How it works", features: "Workspace features", promptPreview: "Example prompt preview" },
  tools: {
    eyebrow: "AI tools",
    title: "A workspace for your next idea.",
    description: "Choose a real workflow. Keep the creative decisions yours.",
    explore: "Explore",
    cards: [
      { kind: "image", title: "Image Generator", description: "Turn a description into an image.", note: "3 free images / day" },
      { kind: "video", title: "AI Video", description: "Create a short video from an idea.", note: "5-second video workspace" },
      { kind: "edit", title: "AI Photo Editor", description: "Upload a photo and describe a change.", note: "Image upload and edit" },
    ],
    note: "Tool previews are concept illustrations. Each workflow opens in your selected language.",
  },
  models: {
    eyebrow: "Available model",
    title: "Less setup. More creating.",
    description: "The free image workspace currently uses Flux Schnell for a focused text-to-image flow.",
    status: "Available now",
    modelDescription: "Fast generation for everyday image creation.",
    details: "Text to image · square output · free daily allowance",
    cta: "Try it in the workspace",
  },
  inspiration: {
    eyebrow: "Inspiration",
    title: "Give your imagination a starting point.",
    description: "Six concept illustrations to help you think about subject, composition and mood. These are inspiration references, not a gallery of generated results.",
    items: enInspiration,
  },
  benefits: {
    eyebrow: "Made to be simple",
    title: "A little less between you and the idea.",
    items: [
      { title: "No sign up", text: "Start your first image without an account or login." },
      { title: "Fast generation", text: "Flux Schnell turns a clear idea into a quick visual starting point." },
      { title: "Simple controls", text: "A focused model and square format keep setup simple." },
      { title: "No profile needed", text: "Explore a first idea without filling out a personal profile." },
      { title: "Multiple styles", text: "Describe a portrait, product scene, landscape or illustration." },
      { title: "Browser based", text: "Describe, review and download in the same browser workspace." },
    ],
  },
  process: {
    eyebrow: "How it works",
    title: "From a thought to a file, in three steps.",
    steps: [
      { title: "Describe", text: "Write the subject, setting and mood you want." },
      { title: "Generate", text: "Ovanto turns your prompt into an image." },
      { title: "Download", text: "Review the result and save the finished file." },
    ],
  },
  features: {
    eyebrow: "Inside the workspace",
    title: "Small details that keep you moving.",
    promptStatus: "Example prompts",
    promptTitle: "A clear place to begin.",
    promptDescription: "Choose an editorial portrait, product scene or quiet landscape. The example fills the prompt for you; edit the subject and details to make it your own.",
    promptCta: "Try an example prompt",
    promptPreviewLabel: "Product scene · example prompt",
    promptText: "A clean product scene on pale stone with one strong shadow",
    promptTags: ["Subject", "Setting", "Light"],
    promptNote: "Edit the wording before you generate.",
    workflowStatus: "Browser workflow",
    workflowTitle: "Keep the prompt and result together.",
    workflowDescription: "Review your image beside the idea that started it. Refine the wording, generate again within the daily allowance, and download the version you want to keep.",
    workflowCta: "Start an image",
    workflowAlt: "Concept illustration of a mountain landscape",
    workflowCaption: "Concept illustration · a quiet landscape at blue hour",
  },
};

const itPlatform: HomePlatformCopy = {
  aria: { tools: "Strumenti AI", models: "Modelli AI disponibili", inspiration: "Ispirazione", benefits: "Vantaggi principali", process: "Come funziona", features: "Funzioni dello spazio di lavoro", promptPreview: "Anteprima del prompt di esempio" },
  tools: {
    eyebrow: "Strumenti AI",
    title: "Uno spazio per la tua prossima idea.",
    description: "Scegli un flusso concreto e mantieni tue le decisioni creative.",
    explore: "Esplora",
    cards: [
      { kind: "image", title: "Generatore di immagini", description: "Trasforma una descrizione in un'immagine.", note: "3 immagini gratis al giorno" },
      { kind: "video", title: "Video AI", description: "Crea un breve video partendo da un'idea.", note: "Spazio di lavoro video da 5 secondi" },
      { kind: "edit", title: "Editor foto AI", description: "Carica una foto e descrivi la modifica.", note: "Caricamento e modifica di immagini" },
    ],
    note: "Le anteprime sono illustrazioni concettuali. Ogni flusso si apre nella lingua scelta.",
  },
  models: {
    eyebrow: "Modello disponibile",
    title: "Meno impostazioni, più creazione.",
    description: "Lo spazio gratuito per le immagini usa Flux Schnell per un flusso testo-immagine mirato.",
    status: "Disponibile ora",
    modelDescription: "Generazione rapida per creare immagini ogni giorno.",
    details: "Da testo a immagine · formato quadrato · quota giornaliera gratuita",
    cta: "Provalo nello spazio di lavoro",
  },
  inspiration: {
    eyebrow: "Ispirazione",
    title: "Dai un punto di partenza alla tua immaginazione.",
    description: "Sei illustrazioni concettuali per pensare a soggetto, composizione e atmosfera. Sono riferimenti per l'ispirazione, non una galleria di risultati generati.",
    items: itInspiration,
  },
  benefits: {
    eyebrow: "Pensato per essere semplice",
    title: "Un po' meno distanza tra te e l'idea.",
    items: [
      { title: "Senza registrazione", text: "Inizia la prima immagine senza account o accesso." },
      { title: "Generazione rapida", text: "Flux Schnell trasforma un'idea chiara in un punto di partenza visivo." },
      { title: "Controlli semplici", text: "Un modello mirato e il formato quadrato rendono facile la configurazione." },
      { title: "Nessun profilo", text: "Esplora una prima idea senza compilare un profilo personale." },
      { title: "Più stili", text: "Descrivi un ritratto, una scena prodotto, un paesaggio o un'illustrazione." },
      { title: "Nel browser", text: "Descrivi, controlla e scarica nello stesso spazio di lavoro del browser." },
    ],
  },
  process: {
    eyebrow: "Come funziona",
    title: "Da un pensiero a un file, in tre passaggi.",
    steps: [
      { title: "Descrivi", text: "Scrivi il soggetto, l'ambiente e l'atmosfera che vuoi." },
      { title: "Genera", text: "Ovanto trasforma il prompt in un'immagine." },
      { title: "Scarica", text: "Controlla il risultato e salva il file finito." },
    ],
  },
  features: {
    eyebrow: "Dentro lo spazio di lavoro",
    title: "Piccoli dettagli per continuare a creare.",
    promptStatus: "Prompt di esempio",
    promptTitle: "Un punto di partenza chiaro.",
    promptDescription: "Scegli un ritratto editoriale, una scena prodotto o un paesaggio calmo. L'esempio riempie il prompt; modifica soggetto e dettagli per renderlo tuo.",
    promptCta: "Prova un prompt di esempio",
    promptPreviewLabel: "Scena prodotto · prompt di esempio",
    promptText: "Una scena prodotto pulita su pietra chiara con un'ombra decisa",
    promptTags: ["Soggetto", "Ambiente", "Luce"],
    promptNote: "Modifica il testo prima di generare.",
    workflowStatus: "Flusso nel browser",
    workflowTitle: "Tieni insieme prompt e risultato.",
    workflowDescription: "Controlla l'immagine accanto all'idea da cui è partita. Affina il testo, genera di nuovo entro la quota giornaliera e scarica la versione da conservare.",
    workflowCta: "Inizia un'immagine",
    workflowAlt: "Illustrazione concettuale di un paesaggio montano",
    workflowCaption: "Illustrazione concettuale · paesaggio calmo all'ora blu",
  },
};

const frPlatform: HomePlatformCopy = {
  aria: { tools: "Outils IA", models: "Modèles IA disponibles", inspiration: "Inspiration", benefits: "Avantages principaux", process: "Fonctionnement", features: "Fonctions de l'espace de travail", promptPreview: "Aperçu du prompt d'exemple" },
  tools: {
    eyebrow: "Outils IA",
    title: "Un espace pour votre prochaine idée.",
    description: "Choisissez un flux concret et gardez les décisions créatives entre vos mains.",
    explore: "Découvrir",
    cards: [
      { kind: "image", title: "Générateur d'images", description: "Transformez une description en image.", note: "3 images gratuites par jour" },
      { kind: "video", title: "Vidéo IA", description: "Créez une courte vidéo à partir d'une idée.", note: "Espace vidéo de 5 secondes" },
      { kind: "edit", title: "Éditeur photo IA", description: "Importez une photo et décrivez une modification.", note: "Importation et retouche d'image" },
    ],
    note: "Les aperçus sont des illustrations conceptuelles. Chaque flux s'ouvre dans la langue choisie.",
  },
  models: {
    eyebrow: "Modèle disponible",
    title: "Moins de réglages, plus de création.",
    description: "L'espace gratuit pour les images utilise Flux Schnell pour un flux texte-image ciblé.",
    status: "Disponible maintenant",
    modelDescription: "Une génération rapide pour les créations d'images du quotidien.",
    details: "Texte vers image · format carré · quota quotidien gratuit",
    cta: "Essayer dans l'espace de travail",
  },
  inspiration: {
    eyebrow: "Inspiration",
    title: "Donnez un point de départ à votre imagination.",
    description: "Six illustrations conceptuelles pour réfléchir au sujet, à la composition et à l'ambiance. Ce sont des références d'inspiration, pas une galerie de résultats générés.",
    items: frInspiration,
  },
  benefits: {
    eyebrow: "Pensé pour rester simple",
    title: "Un peu moins de distance entre vous et l'idée.",
    items: [
      { title: "Sans inscription", text: "Commencez votre première image sans compte ni connexion." },
      { title: "Génération rapide", text: "Flux Schnell transforme une idée claire en première piste visuelle." },
      { title: "Réglages simples", text: "Un modèle ciblé et un format carré simplifient la préparation." },
      { title: "Aucun profil requis", text: "Explorez une première idée sans remplir de profil personnel." },
      { title: "Plusieurs styles", text: "Décrivez un portrait, une scène produit, un paysage ou une illustration." },
      { title: "Dans le navigateur", text: "Décrivez, vérifiez et téléchargez dans le même espace de travail." },
    ],
  },
  process: {
    eyebrow: "Fonctionnement",
    title: "D'une pensée à un fichier, en trois étapes.",
    steps: [
      { title: "Décrire", text: "Écrivez le sujet, le décor et l'ambiance souhaités." },
      { title: "Générer", text: "Ovanto transforme votre prompt en image." },
      { title: "Télécharger", text: "Vérifiez le résultat et enregistrez le fichier final." },
    ],
  },
  features: {
    eyebrow: "Dans l'espace de travail",
    title: "De petits détails pour continuer à avancer.",
    promptStatus: "Prompts d'exemple",
    promptTitle: "Un point de départ clair.",
    promptDescription: "Choisissez un portrait éditorial, une scène produit ou un paysage calme. L'exemple remplit le prompt ; modifiez le sujet et les détails pour le personnaliser.",
    promptCta: "Essayer un prompt d'exemple",
    promptPreviewLabel: "Scène produit · prompt d'exemple",
    promptText: "Une scène produit épurée sur une pierre claire avec une ombre nette",
    promptTags: ["Sujet", "Décor", "Lumière"],
    promptNote: "Modifiez le texte avant de générer.",
    workflowStatus: "Flux dans le navigateur",
    workflowTitle: "Gardez le prompt et le résultat ensemble.",
    workflowDescription: "Regardez l'image à côté de l'idée qui l'a lancée. Affinez le texte, générez à nouveau dans la limite quotidienne et téléchargez la version à conserver.",
    workflowCta: "Commencer une image",
    workflowAlt: "Illustration conceptuelle d'un paysage de montagne",
    workflowCaption: "Illustration conceptuelle · paysage calme à l'heure bleue",
  },
};

const nlPlatform: HomePlatformCopy = {
  aria: { tools: "AI-tools", models: "Beschikbare AI-modellen", inspiration: "Inspiratie", benefits: "Belangrijkste voordelen", process: "Zo werkt het", features: "Functies van de werkruimte", promptPreview: "Voorbeeldprompt bekijken" },
  tools: {
    eyebrow: "AI-tools",
    title: "Een werkruimte voor je volgende idee.",
    description: "Kies een duidelijke workflow en houd de creatieve keuzes zelf in handen.",
    explore: "Bekijken",
    cards: [
      { kind: "image", title: "Afbeeldingengenerator", description: "Maak van een beschrijving een afbeelding.", note: "3 gratis afbeeldingen per dag" },
      { kind: "video", title: "AI-video", description: "Maak een korte video vanuit een idee.", note: "Videowerkruimte van 5 seconden" },
      { kind: "edit", title: "AI-fotobewerker", description: "Upload een foto en beschrijf de wijziging.", note: "Afbeelding uploaden en bewerken" },
    ],
    note: "De voorbeelden zijn conceptillustraties. Elke workflow opent in je gekozen taal.",
  },
  models: {
    eyebrow: "Beschikbaar model",
    title: "Minder instellen, meer maken.",
    description: "De gratis afbeeldingswerkruimte gebruikt Flux Schnell voor een gerichte tekst-naar-beeldworkflow.",
    status: "Nu beschikbaar",
    modelDescription: "Snel genereren voor alledaagse beeldideeën.",
    details: "Tekst naar beeld · vierkante uitvoer · gratis daglimiet",
    cta: "Probeer het in de werkruimte",
  },
  inspiration: {
    eyebrow: "Inspiratie",
    title: "Geef je verbeelding een beginpunt.",
    description: "Zes conceptillustraties om na te denken over onderwerp, compositie en sfeer. Dit zijn inspiratievoorbeelden, geen galerij met gegenereerde resultaten.",
    items: nlInspiration,
  },
  benefits: {
    eyebrow: "Eenvoudig gehouden",
    title: "Minder afstand tussen jou en je idee.",
    items: [
      { title: "Geen registratie", text: "Begin met je eerste afbeelding zonder account of login." },
      { title: "Snel genereren", text: "Flux Schnell maakt van een helder idee snel een visueel beginpunt." },
      { title: "Eenvoudige instellingen", text: "Een gericht model en vierkant formaat houden de voorbereiding eenvoudig." },
      { title: "Geen profiel nodig", text: "Verken een eerste idee zonder een persoonlijk profiel in te vullen." },
      { title: "Verschillende stijlen", text: "Beschrijf een portret, productscène, landschap of illustratie." },
      { title: "In de browser", text: "Beschrijf, bekijk en download in dezelfde browserwerkruimte." },
    ],
  },
  process: {
    eyebrow: "Zo werkt het",
    title: "Van gedachte naar bestand in drie stappen.",
    steps: [
      { title: "Beschrijven", text: "Schrijf het onderwerp, de omgeving en de sfeer die je wilt." },
      { title: "Genereren", text: "Ovanto maakt van je prompt een afbeelding." },
      { title: "Downloaden", text: "Bekijk het resultaat en bewaar het voltooide bestand." },
    ],
  },
  features: {
    eyebrow: "In de werkruimte",
    title: "Kleine details die je op weg houden.",
    promptStatus: "Voorbeeldprompts",
    promptTitle: "Een duidelijk beginpunt.",
    promptDescription: "Kies een redactioneel portret, productscène of rustig landschap. Het voorbeeld vult de prompt voor je in; pas onderwerp en details aan.",
    promptCta: "Probeer een voorbeeldprompt",
    promptPreviewLabel: "Productscène · voorbeeldprompt",
    promptText: "Een rustige productscène op lichte steen met één duidelijke schaduw",
    promptTags: ["Onderwerp", "Omgeving", "Licht"],
    promptNote: "Pas de tekst aan voordat je genereert.",
    workflowStatus: "Browserworkflow",
    workflowTitle: "Houd prompt en resultaat bij elkaar.",
    workflowDescription: "Bekijk je afbeelding naast het idee waarmee je begon. Verfijn de tekst, genereer opnieuw binnen de daglimiet en download de versie die je wilt bewaren.",
    workflowCta: "Start een afbeelding",
    workflowAlt: "Conceptillustratie van een berglandschap",
    workflowCaption: "Conceptillustratie · rustig landschap tijdens het blauwe uur",
  },
};

export const WORKSPACE_COPY: Record<Locale, WorkspaceCopy> = {
  en: {
    header: { logoAria: "Ovanto home", productNavAria: "AI creation tools", image: "AI Image", video: "AI Video", edit: "AI Photo Editor", tools: "AI Tools", pricing: "Pricing", languageNavAria: "Language switcher" },
    workbench: {
      modeNavAria: "Generator mode",
      modes: { image: "Image", edit: "Edit", video: "Video" },
      actions: { image: "Generate Image", edit: "Generate Edit", video: "Generate Video" },
      examples: {
        image: [
          { label: "Editorial portrait", prompt: "A natural editorial portrait in soft morning light, warm neutral tones" },
          { label: "Product scene", prompt: "A clean product scene on pale stone with one strong shadow" },
          { label: "Quiet landscape", prompt: "A quiet mountain landscape at blue hour, atmospheric and detailed" },
        ],
        edit: [
          { label: "Change the light", prompt: "Make the light warmer and softer while keeping the subject unchanged" },
          { label: "Clean the background", prompt: "Remove the small distractions from the background and keep the main subject" },
          { label: "Refine the color", prompt: "Refine the color balance with natural skin tones and gentle contrast" },
        ],
        video: [
          { label: "Slow product reveal", prompt: "A slow product reveal on a simple table with a gentle camera push in" },
          { label: "Wind through grass", prompt: "Tall grass moving in a light breeze at golden hour, calm cinematic motion" },
          { label: "City after rain", prompt: "A quiet city street after rain with reflections and a slow forward movement" },
        ],
      },
    },
    toolsLinks: { label: "Tools", summaryIntro: "Choose the workflow that fits your idea:", image: "create an AI image", edit: "edit a photo with AI", video: "create an AI video", relatedAria: "Related Ovanto tools" },
    footer: { description: "A light workspace for images, video and creative ideas.", toolsHeading: "AI Tools", resourcesHeading: "Resources", languageHeading: "Language", image: "Image Generator", video: "AI Video", edit: "AI Photo Editor", inspiration: "Inspiration", howItWorks: "How it works", faq: "FAQ", supportAria: "Support and legal pages", support: "Support: hello@ovanto.ai", pricing: "Pricing", contentSafety: "Content safety", terms: "Terms", privacy: "Privacy", languagePagesAria: "Ovanto language pages" },
    platform: enPlatform,
  },
  it: {
    header: { logoAria: "Home di Ovanto", productNavAria: "Strumenti per creare con l'AI", image: "Immagini AI", video: "Video AI", edit: "Editor foto AI", tools: "Strumenti AI", pricing: "Prezzi", languageNavAria: "Selettore lingua" },
    workbench: {
      modeNavAria: "Modalità del generatore",
      modes: { image: "Immagine", edit: "Modifica", video: "Video" },
      actions: { image: "Genera immagine", edit: "Genera modifica", video: "Genera video" },
      examples: {
        image: [
          { label: "Ritratto editoriale", prompt: "Ritratto editoriale naturale nella luce morbida del mattino, toni caldi" },
          { label: "Scena prodotto", prompt: "Scena prodotto pulita su pietra chiara con una sola ombra decisa" },
          { label: "Paesaggio calmo", prompt: "Paesaggio montano al crepuscolo blu, atmosferico e dettagliato" },
        ],
        edit: [
          { label: "Cambia la luce", prompt: "Rendi la luce più calda e morbida mantenendo invariato il soggetto" },
          { label: "Pulisci lo sfondo", prompt: "Rimuovi le piccole distrazioni dallo sfondo e conserva il soggetto principale" },
          { label: "Affina il colore", prompt: "Affina il bilanciamento del colore con toni naturali e contrasto delicato" },
        ],
        video: [
          { label: "Reveal prodotto", prompt: "Reveal lento di un prodotto su un tavolo semplice con una dolce spinta della camera" },
          { label: "Erba al vento", prompt: "Erba alta mossa da una brezza leggera al tramonto, movimento cinematografico calmo" },
          { label: "Città dopo la pioggia", prompt: "Strada cittadina tranquilla dopo la pioggia con riflessi e lento movimento in avanti" },
        ],
      },
    },
    toolsLinks: { label: "Strumenti", summaryIntro: "Scegli il flusso adatto alla tua idea:", image: "crea un'immagine con l'AI", edit: "modifica una foto con l'AI", video: "crea un video con l'AI", relatedAria: "Strumenti Ovanto correlati" },
    footer: { description: "Uno spazio leggero per immagini, video e idee creative.", toolsHeading: "Strumenti AI", resourcesHeading: "Risorse", languageHeading: "Lingua", image: "Generatore di immagini", video: "Video AI", edit: "Editor foto AI", inspiration: "Ispirazione", howItWorks: "Come funziona", faq: "Domande frequenti", supportAria: "Supporto e pagine legali", support: "Supporto: hello@ovanto.ai", pricing: "Prezzi", contentSafety: "Sicurezza dei contenuti", terms: "Termini", privacy: "Privacy", languagePagesAria: "Pagine Ovanto nelle varie lingue" },
    platform: itPlatform,
  },
  fr: {
    header: { logoAria: "Accueil Ovanto", productNavAria: "Outils de création IA", image: "Image IA", video: "Vidéo IA", edit: "Éditeur photo IA", tools: "Outils IA", pricing: "Tarifs", languageNavAria: "Sélecteur de langue" },
    workbench: {
      modeNavAria: "Mode de création",
      modes: { image: "Image", edit: "Retouche", video: "Vidéo" },
      actions: { image: "Générer une image", edit: "Générer la retouche", video: "Générer une vidéo" },
      examples: {
        image: [
          { label: "Portrait éditorial", prompt: "Portrait éditorial naturel dans une lumière matinale douce, tons neutres chauds" },
          { label: "Scène produit", prompt: "Scène produit épurée sur une pierre claire avec une ombre nette" },
          { label: "Paysage calme", prompt: "Paysage de montagne calme à l'heure bleue, atmosphérique et détaillé" },
        ],
        edit: [
          { label: "Changer la lumière", prompt: "Rendez la lumière plus chaude et douce en conservant le sujet" },
          { label: "Nettoyer le fond", prompt: "Retirez les petites distractions du fond en gardant le sujet principal" },
          { label: "Affiner les couleurs", prompt: "Affinez l'équilibre des couleurs avec des tons naturels et un contraste doux" },
        ],
        video: [
          { label: "Révélation produit", prompt: "Révélation lente d'un produit sur une table simple avec un léger mouvement avant" },
          { label: "Herbes dans le vent", prompt: "Herbes hautes dans une brise légère à l'heure dorée, mouvement cinématographique calme" },
          { label: "Ville après la pluie", prompt: "Rue calme après la pluie avec des reflets et un lent mouvement vers l'avant" },
        ],
      },
    },
    toolsLinks: { label: "Outils", summaryIntro: "Choisissez le parcours adapté à votre idée :", image: "créer une image avec l'IA", edit: "retoucher une photo avec l'IA", video: "créer une vidéo avec l'IA", relatedAria: "Outils Ovanto associés" },
    footer: { description: "Un espace léger pour les images, les vidéos et les idées créatives.", toolsHeading: "Outils IA", resourcesHeading: "Ressources", languageHeading: "Langue", image: "Générateur d'images", video: "Vidéo IA", edit: "Éditeur photo IA", inspiration: "Inspiration", howItWorks: "Fonctionnement", faq: "Questions fréquentes", supportAria: "Support et pages légales", support: "Support : hello@ovanto.ai", pricing: "Tarifs", contentSafety: "Sécurité des contenus", terms: "Conditions", privacy: "Confidentialité", languagePagesAria: "Pages Ovanto dans les autres langues" },
    platform: frPlatform,
  },
  nl: {
    header: { logoAria: "Ovanto-home", productNavAria: "AI-creatietools", image: "AI-afbeelding", video: "AI-video", edit: "AI-fotobewerker", tools: "AI-tools", pricing: "Prijzen", languageNavAria: "Taalkeuze" },
    workbench: {
      modeNavAria: "Generatoroptie",
      modes: { image: "Afbeelding", edit: "Bewerken", video: "Video" },
      actions: { image: "Afbeelding genereren", edit: "Bewerking genereren", video: "Video genereren" },
      examples: {
        image: [
          { label: "Redactioneel portret", prompt: "Een natuurlijk redactioneel portret in zacht ochtendlicht met warme neutrale tinten" },
          { label: "Productscène", prompt: "Een rustige productscène op lichte steen met één duidelijke schaduw" },
          { label: "Rustig landschap", prompt: "Een rustig berglandschap tijdens het blauwe uur, sfeervol en gedetailleerd" },
        ],
        edit: [
          { label: "Licht aanpassen", prompt: "Maak het licht warmer en zachter en houd het onderwerp hetzelfde" },
          { label: "Achtergrond opruimen", prompt: "Verwijder kleine afleidingen uit de achtergrond en behoud het hoofdonderwerp" },
          { label: "Kleur verfijnen", prompt: "Verfijn de kleurbalans met natuurlijke huidtinten en zacht contrast" },
        ],
        video: [
          { label: "Langzame productonthulling", prompt: "Een langzame productonthulling op een eenvoudige tafel met een zachte camerabeweging" },
          { label: "Gras in de wind", prompt: "Hoog gras in een lichte bries tijdens het gouden uur, rustige filmische beweging" },
          { label: "Stad na regen", prompt: "Een rustige stadsstraat na regen met reflecties en een langzame beweging vooruit" },
        ],
      },
    },
    toolsLinks: { label: "Hulpmiddelen", summaryIntro: "Kies de workflow die bij je idee past:", image: "maak een AI-afbeelding", edit: "bewerk een foto met AI", video: "maak een AI-video", relatedAria: "Gerelateerde Ovanto-tools" },
    footer: { description: "Een lichte werkruimte voor afbeeldingen, video en creatieve ideeën.", toolsHeading: "AI-tools", resourcesHeading: "Bronnen", languageHeading: "Taal", image: "Afbeeldingengenerator", video: "AI-video", edit: "AI-fotobewerker", inspiration: "Inspiratie", howItWorks: "Zo werkt het", faq: "Veelgestelde vragen", supportAria: "Support en juridische pagina's", support: "Support: hello@ovanto.ai", pricing: "Prijzen", contentSafety: "Contentveiligheid", terms: "Voorwaarden", privacy: "Privacy", languagePagesAria: "Ovanto-taalpagina's" },
    platform: nlPlatform,
  },
};
