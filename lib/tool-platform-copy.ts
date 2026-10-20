import type { Locale, ToolKind } from "./site";
import type { HomePlatformCopy, PlatformInspirationCopy } from "./workspace-copy";

type ToolPlatformOverride = {
  tools?: Partial<HomePlatformCopy["tools"]>;
  models?: Partial<HomePlatformCopy["models"]>;
  inspiration?: Partial<HomePlatformCopy["inspiration"]>;
  benefits?: Partial<HomePlatformCopy["benefits"]>;
  process?: Partial<HomePlatformCopy["process"]>;
  features?: Partial<HomePlatformCopy["features"]>;
};

const enVideoInspiration: readonly PlatformInspirationCopy[] = [
  { name: "Portrait scene", detail: "Character, expression, subtle motion", alt: "Concept frame of a portrait scene for a video" },
  { name: "Product reveal", detail: "Object, surface, camera move", alt: "Concept frame of a product scene for a video" },
  { name: "Graphic poster", detail: "Shape, color, visual rhythm", alt: "Concept frame of an abstract poster scene for a video" },
  { name: "Room atmosphere", detail: "Space, materials, camera direction", alt: "Concept frame of a room scene for a video" },
  { name: "Landscape shot", detail: "Place, season, camera pace", alt: "Concept frame of a landscape scene for a video" },
  { name: "Botanical detail", detail: "Subject, texture, gentle motion", alt: "Concept frame of a botanical scene for a video" },
];

const itVideoInspiration: readonly PlatformInspirationCopy[] = [
  { name: "Scena ritratto", detail: "Personaggio, espressione, movimento sottile", alt: "Fotogramma concettuale di una scena ritratto per un video" },
  { name: "Reveal prodotto", detail: "Oggetto, superficie, movimento della camera", alt: "Fotogramma concettuale di una scena prodotto per un video" },
  { name: "Poster grafico", detail: "Forma, colore, ritmo visivo", alt: "Fotogramma concettuale di una scena poster astratto per un video" },
  { name: "Atmosfera d'interni", detail: "Spazio, materiali, direzione della camera", alt: "Fotogramma concettuale di una scena d'interni per un video" },
  { name: "Inquadratura paesaggio", detail: "Luogo, stagione, ritmo della camera", alt: "Fotogramma concettuale di una scena paesaggio per un video" },
  { name: "Dettaglio botanico", detail: "Soggetto, texture, movimento leggero", alt: "Fotogramma concettuale di una scena botanica per un video" },
];

const frVideoInspiration: readonly PlatformInspirationCopy[] = [
  { name: "Scène portrait", detail: "Personnage, expression, mouvement subtil", alt: "Image conceptuelle d'une scène portrait pour une vidéo" },
  { name: "Révélation produit", detail: "Objet, surface, mouvement de caméra", alt: "Image conceptuelle d'une scène produit pour une vidéo" },
  { name: "Affiche graphique", detail: "Forme, couleur, rythme visuel", alt: "Image conceptuelle d'une scène d'affiche abstraite pour une vidéo" },
  { name: "Atmosphère intérieure", detail: "Espace, matières, direction de caméra", alt: "Image conceptuelle d'une scène intérieure pour une vidéo" },
  { name: "Plan de paysage", detail: "Lieu, saison, rythme de caméra", alt: "Image conceptuelle d'une scène de paysage pour une vidéo" },
  { name: "Détail botanique", detail: "Sujet, texture, mouvement léger", alt: "Image conceptuelle d'une scène botanique pour une vidéo" },
];

const nlVideoInspiration: readonly PlatformInspirationCopy[] = [
  { name: "Portretscène", detail: "Personage, expressie, subtiele beweging", alt: "Conceptframe van een portretscène voor een video" },
  { name: "Productonthulling", detail: "Object, oppervlak, camerabeweging", alt: "Conceptframe van een productscène voor een video" },
  { name: "Grafische poster", detail: "Vorm, kleur, visueel ritme", alt: "Conceptframe van een abstracte posterscène voor een video" },
  { name: "Sfeer in een kamer", detail: "Ruimte, materialen, camerarichting", alt: "Conceptframe van een kamerscène voor een video" },
  { name: "Landschapshot", detail: "Plaats, seizoen, cameraritme", alt: "Conceptframe van een landschapsscène voor een video" },
  { name: "Botanisch detail", detail: "Onderwerp, textuur, zachte beweging", alt: "Conceptframe van een botanische scène voor een video" },
];

const enEditInspiration: readonly PlatformInspirationCopy[] = [
  { name: "Portrait light", detail: "Expression and warm tone", alt: "Concept reference for editing a portrait" },
  { name: "Product surface", detail: "Object and presentation", alt: "Concept reference for editing a product photo" },
  { name: "Poster composition", detail: "Shape and color balance", alt: "Concept reference for editing an abstract poster" },
  { name: "Interior atmosphere", detail: "Space and soft light", alt: "Concept reference for editing an interior illustration" },
  { name: "Landscape tone", detail: "Place and color mood", alt: "Concept reference for editing a landscape" },
  { name: "Botanical color", detail: "Leaves and visual balance", alt: "Concept reference for editing a botanical illustration" },
];

const itEditInspiration: readonly PlatformInspirationCopy[] = [
  { name: "Luce del ritratto", detail: "Espressione e tono caldo", alt: "Riferimento concettuale per modificare un ritratto" },
  { name: "Superficie del prodotto", detail: "Oggetto e presentazione", alt: "Riferimento concettuale per modificare una foto prodotto" },
  { name: "Composizione del poster", detail: "Forma ed equilibrio del colore", alt: "Riferimento concettuale per modificare un poster astratto" },
  { name: "Atmosfera d'interni", detail: "Spazio e luce morbida", alt: "Riferimento concettuale per modificare un'illustrazione d'interni" },
  { name: "Tono del paesaggio", detail: "Luogo e atmosfera cromatica", alt: "Riferimento concettuale per modificare un paesaggio" },
  { name: "Colore botanico", detail: "Foglie ed equilibrio visivo", alt: "Riferimento concettuale per modificare un'illustrazione botanica" },
];

const frEditInspiration: readonly PlatformInspirationCopy[] = [
  { name: "Lumière du portrait", detail: "Expression et ton chaleureux", alt: "Référence conceptuelle pour retoucher un portrait" },
  { name: "Surface du produit", detail: "Objet et présentation", alt: "Référence conceptuelle pour retoucher une photo produit" },
  { name: "Composition de l'affiche", detail: "Forme et équilibre des couleurs", alt: "Référence conceptuelle pour retoucher une affiche abstraite" },
  { name: "Atmosphère intérieure", detail: "Espace et lumière douce", alt: "Référence conceptuelle pour retoucher une illustration intérieure" },
  { name: "Ton du paysage", detail: "Lieu et ambiance colorée", alt: "Référence conceptuelle pour retoucher un paysage" },
  { name: "Couleur botanique", detail: "Feuilles et équilibre visuel", alt: "Référence conceptuelle pour retoucher une illustration botanique" },
];

const frRetouchInspiration: readonly PlatformInspirationCopy[] = [
  { name: "Lumière équilibrée", detail: "Douceur et volumes naturels", alt: "Référence conceptuelle pour améliorer la lumière d'une photo" },
  { name: "Couleurs naturelles", detail: "Balance et ambiance fidèle", alt: "Référence conceptuelle pour équilibrer les couleurs d'une photo" },
  { name: "Détails de texture", detail: "Matières et contours lisibles", alt: "Référence conceptuelle pour clarifier les détails d'une photo" },
  { name: "Contraste mesuré", detail: "Relief sans changement de scène", alt: "Référence conceptuelle pour ajuster le contraste d'une photo" },
  { name: "Teint préservé", detail: "Traits et expression reconnaissables", alt: "Référence conceptuelle pour retoucher un portrait naturellement" },
  { name: "Clarté des formes", detail: "Lecture simple et rendu naturel", alt: "Référence conceptuelle pour améliorer la lisibilité d'une image" },
];

const nlEditInspiration: readonly PlatformInspirationCopy[] = [
  { name: "Portretlicht", detail: "Expressie en warme tint", alt: "Conceptreferentie voor het bewerken van een portret" },
  { name: "Productoppervlak", detail: "Object en presentatie", alt: "Conceptreferentie voor het bewerken van een productfoto" },
  { name: "Postercompositie", detail: "Vorm en kleurbalans", alt: "Conceptreferentie voor het bewerken van een abstracte poster" },
  { name: "Sfeer in het interieur", detail: "Ruimte en zacht licht", alt: "Conceptreferentie voor het bewerken van een interieurillustratie" },
  { name: "Landschapstint", detail: "Plaats en kleurstemming", alt: "Conceptreferentie voor het bewerken van een landschap" },
  { name: "Botanische kleur", detail: "Bladeren en visuele balans", alt: "Conceptreferentie voor het bewerken van een botanische illustratie" },
];

type NonImageToolKind = Exclude<ToolKind, "image">;

const frRetouchOverride: ToolPlatformOverride = {
  models: {
    eyebrow: "Modèle de retouche photo",
    title: "Améliorez le rendu, gardez l'image fidèle.",
    description: "Flux Kontext Dev guide des retouches par texte sur une photo importée : lumière, couleurs et détails peuvent être affinés. Le résultat ne garantit ni une restauration sans perte ni une amélioration exacte de chaque détail.",
    modelDescription: "Flux Kontext Dev pour une retouche guidée de la lumière, des couleurs et des détails d'une photo importée.",
    details: "Photo importée · lumière, couleurs et détails · quota quotidien gratuit",
    cta: "Ouvrir l'espace de retouche",
  },
  inspiration: {
    title: "Définissez l'amélioration avant de l'appliquer.",
    description: "Six références conceptuelles pour préciser la lumière, les couleurs, les textures et le niveau de détail à préserver. Elles montrent des directions de retouche, pas des résultats garantis.",
    items: frRetouchInspiration,
  },
  benefits: {
    title: "Améliorez la photo sans perdre son intention.",
    items: [
      { title: "Lumière équilibrée", text: "Décrivez une lumière plus douce ou mieux répartie en conservant le sujet." },
      { title: "Couleurs plus lisibles", text: "Demandez une balance naturelle sans imposer un nouveau style à la scène." },
      { title: "Détails à préserver", text: "Nommez les textures, contours et traits qui doivent rester reconnaissables." },
      { title: "Retouche mesurée", text: "Une instruction ciblée aide à limiter le changement au rendu de la photo." },
      { title: "Comparaison avant/après", text: "Vérifiez la fidélité de l'image source avant de conserver le résultat." },
      { title: "Dans le navigateur", text: "Importez, comparez et téléchargez dans le même espace de retouche." },
    ],
  },
  process: {
    title: "De la photo source à une amélioration ciblée, en trois étapes.",
    steps: [
      { title: "Importer", text: "Choisissez la photo dont vous voulez améliorer le rendu." },
      { title: "Décrire", text: "Précisez la lumière, les couleurs, les détails et ce qui doit rester reconnaissable." },
      { title: "Comparer", text: "Vérifiez le résultat avec la source : la retouche guidée par le texte peut modifier certains détails." },
    ],
  },
  features: {
    promptTitle: "Un brief pour améliorer le rendu.",
    promptDescription: "Indiquez la lumière, la balance des couleurs et les détails à clarifier. Précisez ce qui doit rester reconnaissable. Flux Kontext Dev suit une direction textuelle et ne garantit pas une restauration sans perte.",
    promptCta: "Essayer un prompt de retouche",
    promptPreviewLabel: "Brief d'amélioration · prompt d'exemple",
    promptText: "Équilibrez la lumière, gardez les traits naturels et clarifiez légèrement les détails",
    promptTags: ["Lumière", "Couleurs", "Détails"],
    promptNote: "Modifiez le texte et vérifiez le résultat avant de le conserver.",
    workflowTitle: "Comparez la retouche à la photo source.",
    workflowDescription: "Vérifiez les traits, les textures et les couleurs après chaque résultat. Affinez le prompt si nécessaire : une retouche guidée par le texte peut modifier certains détails.",
    workflowCta: "Commencer une retouche",
    workflowAlt: "Référence conceptuelle pour améliorer la lumière et les couleurs d'une photo",
    workflowCaption: "Référence conceptuelle · une direction d'amélioration, pas un résultat garanti",
  },
};

const frFreeEditInspiration: readonly PlatformInspirationCopy[] = [
  { name: "Lumière plus douce", detail: "Une photo plus lisible au quotidien", alt: "Référence conceptuelle pour une photo à la lumière plus douce" },
  { name: "Couleurs équilibrées", detail: "Des tons naturels et mieux définis", alt: "Référence conceptuelle pour équilibrer les couleurs d'une photo" },
  { name: "Détails plus clairs", detail: "Contours et textures faciles à vérifier", alt: "Référence conceptuelle pour clarifier les détails d'une photo" },
  { name: "Portrait naturel", detail: "Traits et expression à préserver", alt: "Référence conceptuelle pour améliorer un portrait naturel" },
  { name: "Photo produit", detail: "Matières et lumière plus lisibles", alt: "Référence conceptuelle pour améliorer une photo produit" },
  { name: "Paysage fidèle", detail: "Une ambiance conservée avec soin", alt: "Référence conceptuelle pour améliorer un paysage sans changer sa scène" },
];

const nlFreeEditInspiration: readonly PlatformInspirationCopy[] = [
  { name: "Zachter licht", detail: "Een foto die rustiger leest", alt: "Conceptreferentie voor een foto met zachter licht" },
  { name: "Natuurlijke kleuren", detail: "Een evenwichtige kleurbalans", alt: "Conceptreferentie voor natuurlijke kleuren in een foto" },
  { name: "Duidelijke details", detail: "Randen en texturen beter zichtbaar", alt: "Conceptreferentie voor duidelijkere details in een foto" },
  { name: "Natuurlijk portret", detail: "Gezicht en expressie herkenbaar", alt: "Conceptreferentie voor een natuurlijk verbeterd portret" },
  { name: "Productfoto", detail: "Materiaal en licht beter leesbaar", alt: "Conceptreferentie voor een verbeterde productfoto" },
  { name: "Landschap behouden", detail: "De sfeer blijft herkenbaar", alt: "Conceptreferentie voor een verbeterd landschap zonder nieuwe scène" },
];

const frFreeEditOverride: ToolPlatformOverride = {
  tools: {
    eyebrow: "Outils Ovanto",
    title: "Une retouche gratuite, dans un parcours simple.",
    description: "Importez une photo, décrivez une amélioration précise et vérifiez le résultat avant de le garder.",
    cards: [
      { kind: "image", title: "Générateur d'images", description: "Créez une image à partir d'une idée.", note: "3 images gratuites par jour" },
      { kind: "video", title: "Vidéo IA", description: "Créez une courte vidéo à partir d'une idée.", note: "1 vidéo gratuite par jour" },
      { kind: "edit", title: "Retouche photo gratuite", description: "Importez une photo et préparez une amélioration ciblée.", note: "1 retouche par jour et par IP" },
    ],
    note: "Chaque parcours a ses propres limites. La retouche gratuite accepte une photo jusqu'à 10 Mo, sans inscription.",
  },
  models: {
    eyebrow: "Fonctionnement technique",
    title: "Une retouche gratuite, avec des limites claires.",
    description: "Flux Kontext Dev intervient comme méthode technique pour guider une retouche sur la photo importée. Le résultat peut modifier certains détails : vérifiez toujours l'image avant de la télécharger.",
    modelDescription: "Flux Kontext Dev guide la lumière, les couleurs ou les détails selon votre instruction.",
    details: "1 retouche gratuite par jour et par IP · renouvellement à 00:00 UTC · photo jusqu'à 10 Mo",
    cta: "Ouvrir l'espace de retouche",
  },
  inspiration: {
    title: "Choisissez l'amélioration qui compte.",
    description: "Six références pour préciser la lumière, les couleurs ou les détails d'une photo. Elles montrent des directions possibles, pas des résultats garantis.",
    items: frFreeEditInspiration,
  },
  benefits: {
    title: "Les conditions restent visibles avant la retouche.",
    items: [
      { title: "1 retouche par jour", text: "La retouche gratuite est limitée à 1 utilisation par jour et par IP, avec un renouvellement à 00:00 UTC." },
      { title: "Sans inscription", text: "Importez une photo et commencez dans le navigateur sans créer de compte." },
      { title: "Photo jusqu'à 10 Mo", text: "Utilisez une image JPEG, PNG, GIF ou WEBP de 10 Mo maximum." },
      { title: "Une demande ciblée", text: "Décrivez la lumière, les couleurs ou les détails à améliorer au lieu de demander un éditeur manuel général." },
      { title: "Vérifiez avant de garder", text: "Comparez le résultat avec la photo source : une retouche guidée peut modifier certains détails." },
      { title: "Des limites simples", text: "Le parcours traite une photo à la fois et ne promet ni retouches illimitées, ni traitement en lot, ni restauration sans perte." },
    ],
  },
  process: {
    title: "De la photo à une amélioration gratuite, en trois étapes.",
    steps: [
      { title: "Importer", text: "Choisissez une photo compatible de 10 Mo maximum, sans inscription." },
      { title: "Décrire", text: "Indiquez une priorité : lumière, couleurs, détails ou élément à préserver." },
      { title: "Vérifier", text: "Comparez le résultat avec l'original avant de le télécharger." },
    ],
  },
  features: {
    promptTitle: "Une demande pour une retouche ciblée.",
    promptDescription: "Précisez l'amélioration souhaitée et ce qui doit rester reconnaissable. Une instruction courte aide à garder le contrôle sur un résultat qui peut tout de même modifier certains détails.",
    promptCta: "Essayer une retouche gratuite",
    promptPreviewLabel: "Demande de retouche · exemple",
    promptText: "Adoucissez la lumière, équilibrez les couleurs et gardez les traits naturels",
    promptTags: ["Lumière", "Couleurs", "Préserver"],
    promptNote: "Une photo importée de 10 Mo maximum est nécessaire avant la génération.",
    workflowTitle: "Comparez avant de télécharger.",
    workflowDescription: "Le résultat reste dans le même espace pour vous permettre de vérifier les traits, les textures et les couleurs. La limite gratuite est de 1 retouche par jour et par IP.",
    workflowCta: "Commencer une retouche",
    workflowAlt: "Référence conceptuelle pour améliorer une photo sans changer son intention",
    workflowCaption: "Référence conceptuelle · une direction d'amélioration, pas un résultat garanti",
  },
};

const nlFreeEditOverride: ToolPlatformOverride = {
  tools: {
    eyebrow: "Ovanto-tools",
    title: "Gratis een foto verbeteren, stap voor stap.",
    description: "Upload een foto, beschrijf één gerichte verbetering en controleer het resultaat voordat je het bewaart.",
    cards: [
      { kind: "image", title: "Afbeeldingengenerator", description: "Maak een afbeelding vanuit een idee.", note: "3 gratis afbeeldingen per dag" },
      { kind: "video", title: "AI-video", description: "Maak een korte video vanuit een idee.", note: "1 gratis video per dag" },
      { kind: "edit", title: "Gratis foto bewerken", description: "Upload een foto en beschrijf een gerichte verbetering.", note: "1 bewerking per dag en per IP" },
    ],
    note: "Elke workflow heeft eigen grenzen. Gratis fotobewerking accepteert één foto tot 10 MB, zonder registratie.",
  },
  models: {
    eyebrow: "Technische werking",
    title: "Gratis bewerken, met duidelijke grenzen.",
    description: "Flux Kontext Dev is de technische methode achter de tekstgestuurde verbetering van je geüploade foto. Het resultaat kan details wijzigen: controleer de afbeelding altijd voordat je downloadt.",
    modelDescription: "Flux Kontext Dev volgt je instructie voor licht, kleur of details.",
    details: "1 gratis bewerking per dag en per IP · vernieuwing om 00:00 UTC · foto tot 10 MB",
    cta: "Open de fotobewerker",
  },
  inspiration: {
    title: "Kies de verbetering die telt.",
    description: "Zes referenties om licht, kleuren of details van een foto te beschrijven. Ze tonen mogelijke richtingen, geen gegarandeerde resultaten.",
    items: nlFreeEditInspiration,
  },
  benefits: {
    title: "De voorwaarden blijven zichtbaar voordat je bewerkt.",
    items: [
      { title: "1 bewerking per dag", text: "Gratis bewerken is beperkt tot 1 gebruik per dag en per IP en wordt om 00:00 UTC vernieuwd." },
      { title: "Geen registratie", text: "Upload een foto en begin in de browser zonder een account te maken." },
      { title: "Foto tot 10 MB", text: "Gebruik een JPEG-, PNG-, GIF- of WEBP-afbeelding van maximaal 10 MB." },
      { title: "Gerichte opdracht", text: "Beschrijf licht, kleuren of details die beter mogen worden in plaats van een algemene handmatige editor te verwachten." },
      { title: "Controleer eerst", text: "Vergelijk het resultaat met de bronfoto: een tekstgestuurde bewerking kan details veranderen." },
      { title: "Eenvoudige grenzen", text: "De workflow verwerkt één foto per keer en belooft geen onbeperkte bewerkingen, batchverwerking of verliesvrije restauratie." },
    ],
  },
  process: {
    title: "Van foto naar gratis verbetering in drie stappen.",
    steps: [
      { title: "Uploaden", text: "Kies een compatibele foto van maximaal 10 MB, zonder registratie." },
      { title: "Beschrijven", text: "Noem één prioriteit: licht, kleuren, details of wat hetzelfde moet blijven." },
      { title: "Controleren", text: "Vergelijk het resultaat met het origineel voordat je downloadt." },
    ],
  },
  features: {
    promptTitle: "Een opdracht voor gerichte verbetering.",
    promptDescription: "Beschrijf de verbetering en wat herkenbaar moet blijven. Een korte instructie helpt je het resultaat te beoordelen, ook wanneer sommige details kunnen veranderen.",
    promptCta: "Probeer gratis fotobewerking",
    promptPreviewLabel: "Bewerkingsopdracht · voorbeeld",
    promptText: "Maak het licht zachter, breng de kleuren in balans en behoud de natuurlijke gelaatstrekken",
    promptTags: ["Licht", "Kleuren", "Behouden"],
    promptNote: "Upload eerst een foto van maximaal 10 MB voordat je genereert.",
    workflowTitle: "Vergelijk voordat je downloadt.",
    workflowDescription: "Het resultaat blijft in dezelfde werkruimte zodat je gezicht, texturen en kleuren kunt controleren. De gratis limiet is 1 bewerking per dag en per IP.",
    workflowCta: "Start een bewerking",
    workflowAlt: "Conceptreferentie voor een fotoverbetering die de bedoeling van de foto behoudt",
    workflowCaption: "Conceptreferentie · een verbeteringsrichting, geen gegarandeerd resultaat",
  },
};

const overrides: Record<Locale, Record<NonImageToolKind, ToolPlatformOverride>> = {
  en: {
    video: {
      models: {
        eyebrow: "Video models",
        title: "A short scene, clearly set up.",
        description: "Free video uses Wan 2.5 for a 5-second 480p clip. Paid access uses Kling 2.5 Turbo Pro for a 5-second provider-quality output.",
        modelDescription: "Free: Wan 2.5 · 5 seconds · 480p. Paid: Kling 2.5 Turbo Pro · 5 seconds · provider output quality.",
        details: "Text to video · free daily allowance or paid credits",
        cta: "Open the video workspace",
      },
      inspiration: {
        title: "Plan the scene before you generate.",
        description: "Six concept frames to help plan subject, camera movement and atmosphere. They are composition references, not generated video results.",
        items: enVideoInspiration,
      },
      benefits: {
        title: "Keep the motion simple and intentional.",
        items: [
          { title: "No sign up", text: "Start a first video idea without an account or login." },
          { title: "Short video generation", text: "Wan 2.5 creates a focused 5-second, 480p free clip." },
          { title: "Simple motion direction", text: "Describe the subject, movement and atmosphere in one clear prompt." },
          { title: "Clear scene planning", text: "Use a concept frame to think through the shot before generating." },
          { title: "Free or paid access", text: "Use the daily free video or choose Kling 2.5 Turbo Pro with paid credits." },
          { title: "Browser based", text: "Describe, review and download the video in the same workspace." },
        ],
      },
      process: {
        title: "From a scene idea to a short clip, in three steps.",
        steps: [
          { title: "Describe", text: "Write the subject, setting, movement and mood you want." },
          { title: "Generate", text: "Ovanto sends the scene to the selected video model." },
          { title: "Review", text: "Check the clip and download the version you want to keep." },
        ],
      },
      features: {
        promptTitle: "A clear motion brief.",
        promptDescription: "Describe what is in the scene, how the camera or subject should move, and the atmosphere you want. Edit the example before generating.",
        promptCta: "Try a video prompt",
        promptPreviewLabel: "Motion brief · example prompt",
        promptText: "A slow product reveal on a simple table with a gentle camera push in",
        promptTags: ["Subject", "Motion", "Mood"],
        promptNote: "Edit the wording before you generate.",
        workflowTitle: "Keep the scene and result together.",
        workflowDescription: "Review the returned clip beside the idea that started it. Refine the movement or atmosphere and download the version you want to keep.",
        workflowCta: "Start a video",
        workflowAlt: "Concept frame for a quiet mountain landscape video",
        workflowCaption: "Concept frame · a quiet landscape shot, not a generated video result",
      },
    },
    edit: {
      models: {
        eyebrow: "Photo editing model",
        title: "Describe the change, keep the subject.",
        description: "The free photo editor uses Flux Kontext Dev for text-directed changes to an uploaded image.",
        modelDescription: "Flux Kontext Dev for focused edits to an uploaded photo.",
        details: "Image upload · text-directed changes · free daily allowance",
        cta: "Open the photo editor",
      },
      inspiration: {
        title: "Plan the edit before you apply it.",
        description: "Six concept references to help define the change, the area to preserve and the final atmosphere. They are editing references, not generated results.",
        items: enEditInspiration,
      },
      benefits: {
        title: "Keep the original idea in view.",
        items: [
          { title: "Upload first", text: "Start with a JPEG, PNG, GIF or WEBP photo up to 10 MB." },
          { title: "Text-directed edits", text: "Describe the change you want while keeping the main subject clear." },
          { title: "Preserve what matters", text: "Say which person, product or detail should stay unchanged." },
          { title: "Focused controls", text: "A single prompt keeps the edit easy to review and refine." },
          { title: "Compare the result", text: "Check the edited image against the uploaded photo before downloading." },
          { title: "Browser based", text: "Upload, review and download in the same photo editing workspace." },
        ],
      },
      process: {
        title: "From an uploaded photo to a considered edit, in three steps.",
        steps: [
          { title: "Upload", text: "Choose the photo you want to work on." },
          { title: "Describe", text: "Name the change and what must remain unchanged." },
          { title: "Review", text: "Check the result and download the edit you want to keep." },
        ],
      },
      features: {
        promptTitle: "A precise edit brief.",
        promptDescription: "Name the area to change, the direction of the edit and the details to preserve. The example helps you start with a clear instruction.",
        promptCta: "Try an edit prompt",
        promptPreviewLabel: "Edit brief · example prompt",
        promptText: "Make the light warmer and softer while keeping the subject unchanged",
        promptTags: ["Change", "Preserve", "Finish"],
        promptNote: "Upload a photo before you generate.",
        workflowTitle: "Keep the original and edit together.",
        workflowDescription: "Review the changed photo beside the uploaded original. Refine the instruction when a detail needs more care, then download the result.",
        workflowCta: "Start an edit",
        workflowAlt: "Concept reference for a carefully edited photo scene",
        workflowCaption: "Concept reference · an editing direction, not a generated result",
      },
    },
  },
  it: {
    video: {
      models: {
        eyebrow: "Modelli video",
        title: "Una scena breve, impostata con chiarezza.",
        description: "Il video gratuito usa Wan 2.5 per una clip di 5 secondi a 480p. L'accesso a pagamento usa Kling 2.5 Turbo Pro per un output di 5 secondi alla qualità del provider.",
        modelDescription: "Gratis: Wan 2.5 · 5 secondi · 480p. A pagamento: Kling 2.5 Turbo Pro · 5 secondi · qualità di output del provider.",
        details: "Da testo a video · quota giornaliera gratuita o crediti a pagamento",
        cta: "Apri lo spazio video",
      },
      inspiration: {
        title: "Pianifica la scena prima di generare.",
        description: "Sei fotogrammi concettuali per pensare a soggetto, movimento della camera e atmosfera. Sono riferimenti di composizione, non risultati video generati.",
        items: itVideoInspiration,
      },
      benefits: {
        title: "Mantieni il movimento semplice e intenzionale.",
        items: [
          { title: "Senza registrazione", text: "Inizia un'idea video senza account o accesso." },
          { title: "Video brevi", text: "Wan 2.5 crea una clip gratuita mirata di 5 secondi a 480p." },
          { title: "Movimento chiaro", text: "Descrivi soggetto, movimento e atmosfera in un prompt chiaro." },
          { title: "Pianifica la scena", text: "Usa un fotogramma concettuale per pensare all'inquadratura prima di generare." },
          { title: "Accesso gratis o a pagamento", text: "Usa il video giornaliero gratuito o Kling 2.5 Turbo Pro con crediti a pagamento." },
          { title: "Nel browser", text: "Descrivi, controlla e scarica il video nello stesso spazio di lavoro." },
        ],
      },
      process: {
        title: "Dall'idea di una scena a una clip breve, in tre passaggi.",
        steps: [
          { title: "Descrivi", text: "Scrivi soggetto, ambiente, movimento e atmosfera." },
          { title: "Genera", text: "Ovanto invia la scena al modello video selezionato." },
          { title: "Controlla", text: "Controlla la clip e scarica la versione da conservare." },
        ],
      },
      features: {
        promptTitle: "Un brief di movimento chiaro.",
        promptDescription: "Descrivi cosa c'è nella scena, come deve muoversi la camera o il soggetto e quale atmosfera vuoi. Modifica l'esempio prima di generare.",
        promptCta: "Prova un prompt video",
        promptPreviewLabel: "Brief di movimento · prompt di esempio",
        promptText: "Reveal lento di un prodotto su un tavolo semplice con una dolce spinta della camera",
        promptTags: ["Soggetto", "Movimento", "Atmosfera"],
        promptNote: "Modifica il testo prima di generare.",
        workflowTitle: "Tieni insieme scena e risultato.",
        workflowDescription: "Controlla la clip accanto all'idea da cui è partita. Affina movimento o atmosfera e scarica la versione da conservare.",
        workflowCta: "Inizia un video",
        workflowAlt: "Fotogramma concettuale per un video di paesaggio montano",
        workflowCaption: "Fotogramma concettuale · una scena di paesaggio, non un video generato",
      },
    },
    edit: {
      models: {
        eyebrow: "Modello per modificare foto",
        title: "Descrivi la modifica, conserva il soggetto.",
        description: "L'editor foto gratuito usa Flux Kontext Dev per modifiche guidate dal testo su un'immagine caricata.",
        modelDescription: "Flux Kontext Dev per modifiche mirate a una foto caricata.",
        details: "Caricamento immagine · modifica descritta a parole · quota giornaliera gratuita",
        cta: "Apri l'editor foto",
      },
      inspiration: {
        title: "Pianifica la modifica prima di applicarla.",
        description: "Sei riferimenti concettuali per definire la modifica, l'area da preservare e l'atmosfera finale. Sono riferimenti di editing, non risultati generati.",
        items: itEditInspiration,
      },
      benefits: {
        title: "Tieni a vista l'idea originale.",
        items: [
          { title: "Carica prima", text: "Inizia con una foto JPEG, PNG, GIF o WEBP fino a 10 MB." },
          { title: "Modifica testuale", text: "Descrivi la modifica mantenendo chiaro il soggetto principale." },
          { title: "Conserva ciò che conta", text: "Indica quale persona, prodotto o dettaglio deve restare invariato." },
          { title: "Controlli mirati", text: "Un prompt mantiene la modifica facile da controllare e affinare." },
          { title: "Confronta il risultato", text: "Controlla la foto modificata rispetto all'originale prima di scaricarla." },
          { title: "Nel browser", text: "Carica, controlla e scarica nello stesso spazio di editing." },
        ],
      },
      process: {
        title: "Da una foto caricata a una modifica ragionata, in tre passaggi.",
        steps: [
          { title: "Carica", text: "Scegli la foto su cui vuoi lavorare." },
          { title: "Descrivi", text: "Indica la modifica e ciò che deve restare invariato." },
          { title: "Controlla", text: "Controlla il risultato e scarica la modifica da conservare." },
        ],
      },
      features: {
        promptTitle: "Un brief di modifica preciso.",
        promptDescription: "Indica l'area da cambiare, la direzione della modifica e i dettagli da preservare. L'esempio aiuta a iniziare con un'istruzione chiara.",
        promptCta: "Prova un prompt di modifica",
        promptPreviewLabel: "Brief di modifica · prompt di esempio",
        promptText: "Rendi la luce più calda e morbida mantenendo invariato il soggetto",
        promptTags: ["Modifica", "Preserva", "Finitura"],
        promptNote: "Carica una foto prima di generare.",
        workflowTitle: "Tieni insieme originale e modifica.",
        workflowDescription: "Controlla la foto modificata accanto all'originale caricata. Affina l'istruzione quando un dettaglio richiede più cura, poi scarica il risultato.",
        workflowCta: "Inizia una modifica",
        workflowAlt: "Riferimento concettuale per una foto modificata con cura",
        workflowCaption: "Riferimento concettuale · una direzione di editing, non un risultato generato",
      },
    },
  },
  fr: {
    video: {
      models: {
        eyebrow: "Modèles vidéo",
        title: "Une scène courte, préparée avec clarté.",
        description: "La vidéo gratuite utilise Wan 2.5 pour un clip de 5 secondes en 480p. L'accès payant utilise Kling 2.5 Turbo Pro pour une sortie de 5 secondes à la qualité du fournisseur.",
        modelDescription: "Gratuit : Wan 2.5 · 5 secondes · 480p. Payant : Kling 2.5 Turbo Pro · 5 secondes · qualité de sortie du fournisseur.",
        details: "Texte vers vidéo · quota quotidien gratuit ou crédits payants",
        cta: "Ouvrir l'espace vidéo",
      },
      inspiration: {
        title: "Préparez la scène avant de générer.",
        description: "Six images conceptuelles pour réfléchir au sujet, au mouvement de caméra et à l'atmosphère. Ce sont des références de composition, pas des résultats vidéo générés.",
        items: frVideoInspiration,
      },
      benefits: {
        title: "Gardez un mouvement simple et intentionnel.",
        items: [
          { title: "Sans inscription", text: "Commencez une idée vidéo sans compte ni connexion." },
          { title: "Vidéo courte", text: "Wan 2.5 crée un clip gratuit ciblé de 5 secondes en 480p." },
          { title: "Mouvement clair", text: "Décrivez le sujet, le mouvement et l'atmosphère dans un prompt clair." },
          { title: "Préparez la scène", text: "Utilisez une image conceptuelle pour penser au plan avant de générer." },
          { title: "Accès gratuit ou payant", text: "Utilisez la vidéo quotidienne gratuite ou Kling 2.5 Turbo Pro avec des crédits payants." },
          { title: "Dans le navigateur", text: "Décrivez, vérifiez et téléchargez la vidéo dans le même espace." },
        ],
      },
      process: {
        title: "De l'idée de scène à un clip court, en trois étapes.",
        steps: [
          { title: "Décrire", text: "Écrivez le sujet, le décor, le mouvement et l'ambiance souhaités." },
          { title: "Générer", text: "Ovanto envoie la scène au modèle vidéo sélectionné." },
          { title: "Vérifier", text: "Vérifiez le clip et téléchargez la version à conserver." },
        ],
      },
      features: {
        promptTitle: "Un brief de mouvement clair.",
        promptDescription: "Décrivez ce qui se trouve dans la scène, le mouvement de la caméra ou du sujet et l'atmosphère souhaitée. Modifiez l'exemple avant de générer.",
        promptCta: "Essayer un prompt vidéo",
        promptPreviewLabel: "Brief de mouvement · prompt d'exemple",
        promptText: "Révélation lente d'un produit sur une table simple avec un léger mouvement avant",
        promptTags: ["Sujet", "Mouvement", "Ambiance"],
        promptNote: "Modifiez le texte avant de générer.",
        workflowTitle: "Gardez la scène et le résultat ensemble.",
        workflowDescription: "Vérifiez le clip à côté de l'idée qui l'a lancé. Affinez le mouvement ou l'atmosphère et téléchargez la version à conserver.",
        workflowCta: "Commencer une vidéo",
        workflowAlt: "Image conceptuelle pour une vidéo de paysage de montagne",
        workflowCaption: "Image conceptuelle · un plan de paysage, pas un résultat vidéo généré",
      },
    },
    edit: {
      models: {
        eyebrow: "Modèle de retouche photo",
        title: "Décrivez le changement, gardez le sujet.",
        description: "L'éditeur photo gratuit utilise Flux Kontext Dev pour modifier par le texte une image importée.",
        modelDescription: "Flux Kontext Dev pour des retouches ciblées sur une photo importée.",
        details: "Import d'image · modifications guidées par le texte · quota quotidien gratuit",
        cta: "Ouvrir l'éditeur photo",
      },
      inspiration: {
        title: "Préparez la retouche avant de l'appliquer.",
        description: "Six références conceptuelles pour définir la modification, la zone à préserver et l'atmosphère finale. Ce sont des références de retouche, pas des résultats générés.",
        items: frEditInspiration,
      },
      benefits: {
        title: "Gardez l'idée originale sous les yeux.",
        items: [
          { title: "Importez d'abord", text: "Commencez avec une photo JPEG, PNG, GIF ou WEBP jusqu'à 10 Mo." },
          { title: "Retouche par le texte", text: "Décrivez le changement en gardant le sujet principal clair." },
          { title: "Préservez l'essentiel", text: "Indiquez la personne, le produit ou le détail à conserver." },
          { title: "Réglages ciblés", text: "Un prompt rend la retouche facile à vérifier et à affiner." },
          { title: "Comparez le résultat", text: "Vérifiez la photo retouchée avec l'original avant de la télécharger." },
          { title: "Dans le navigateur", text: "Importez, vérifiez et téléchargez dans le même espace de retouche." },
        ],
      },
      process: {
        title: "De la photo importée à une retouche réfléchie, en trois étapes.",
        steps: [
          { title: "Importer", text: "Choisissez la photo sur laquelle vous voulez travailler." },
          { title: "Décrire", text: "Nommez le changement et ce qui doit rester inchangé." },
          { title: "Vérifier", text: "Vérifiez le résultat et téléchargez la retouche à conserver." },
        ],
      },
      features: {
        promptTitle: "Un brief de retouche précis.",
        promptDescription: "Nommez la zone à modifier, la direction de la retouche et les détails à préserver. L'exemple aide à commencer avec une instruction claire.",
        promptCta: "Essayer un prompt de retouche",
        promptPreviewLabel: "Brief de retouche · prompt d'exemple",
        promptText: "Rendez la lumière plus chaude et douce en conservant le sujet",
        promptTags: ["Changement", "Préserver", "Finition"],
        promptNote: "Importez une photo avant de générer.",
        workflowTitle: "Gardez l'original et la retouche ensemble.",
        workflowDescription: "Vérifiez la photo modifiée à côté de l'original importé. Affinez l'instruction lorsqu'un détail demande plus de soin, puis téléchargez le résultat.",
        workflowCta: "Commencer une retouche",
        workflowAlt: "Référence conceptuelle pour une scène photo soigneusement retouchée",
        workflowCaption: "Référence conceptuelle · une direction de retouche, pas un résultat généré",
      },
    },
  },
  nl: {
    video: {
      models: {
        eyebrow: "Videomodellen",
        title: "Een korte scène, helder opgezet.",
        description: "Gratis video gebruikt Wan 2.5 voor een clip van 5 seconden in 480p. Betaalde toegang gebruikt Kling 2.5 Turbo Pro voor 5 seconden output op providerkwaliteit.",
        modelDescription: "Gratis: Wan 2.5 · 5 seconden · 480p. Betaald: Kling 2.5 Turbo Pro · 5 seconden · outputkwaliteit van de provider.",
        details: "Tekst naar video · gratis daglimiet of betaalde credits",
        cta: "Open de videowerkruimte",
      },
      inspiration: {
        title: "Plan de scène voordat je genereert.",
        description: "Zes conceptframes om onderwerp, camerabeweging en sfeer te plannen. Het zijn compositiereferenties, geen gegenereerde videoresultaten.",
        items: nlVideoInspiration,
      },
      benefits: {
        title: "Houd beweging eenvoudig en doelgericht.",
        items: [
          { title: "Geen registratie", text: "Begin met een eerste video-idee zonder account of login." },
          { title: "Korte video", text: "Wan 2.5 maakt een gerichte gratis clip van 5 seconden in 480p." },
          { title: "Duidelijke beweging", text: "Beschrijf onderwerp, beweging en sfeer in één heldere prompt." },
          { title: "Plan de scène", text: "Gebruik een conceptframe om het shot te bedenken voordat je genereert." },
          { title: "Gratis of betaald", text: "Gebruik de dagelijkse gratis video of Kling 2.5 Turbo Pro met betaalde credits." },
          { title: "In de browser", text: "Beschrijf, bekijk en download de video in dezelfde werkruimte." },
        ],
      },
      process: {
        title: "Van scène-idee naar korte clip in drie stappen.",
        steps: [
          { title: "Beschrijven", text: "Schrijf onderwerp, omgeving, beweging en sfeer die je wilt." },
          { title: "Genereren", text: "Ovanto stuurt de scène naar het gekozen videomodel." },
          { title: "Bekijken", text: "Bekijk de clip en download de versie die je wilt bewaren." },
        ],
      },
      features: {
        promptTitle: "Een duidelijke bewegingsbrief.",
        promptDescription: "Beschrijf wat er in de scène staat, hoe de camera of het onderwerp beweegt en welke sfeer je wilt. Pas het voorbeeld aan voordat je genereert.",
        promptCta: "Probeer een videoprompt",
        promptPreviewLabel: "Bewegingsbrief · voorbeeldprompt",
        promptText: "Een langzame productonthulling op een eenvoudige tafel met een zachte camerabeweging",
        promptTags: ["Onderwerp", "Beweging", "Sfeer"],
        promptNote: "Pas de tekst aan voordat je genereert.",
        workflowTitle: "Houd scène en resultaat bij elkaar.",
        workflowDescription: "Bekijk de geretourneerde clip naast het idee waarmee je begon. Verfijn de beweging of sfeer en download de versie die je wilt bewaren.",
        workflowCta: "Start een video",
        workflowAlt: "Conceptframe voor een video van een rustig berglandschap",
        workflowCaption: "Conceptframe · een landschapshot, geen gegenereerd videoresultaat",
      },
    },
    edit: {
      models: {
        eyebrow: "Model voor fotobewerking",
        title: "Beschrijf de wijziging, behoud het onderwerp.",
        description: "De gratis fotobewerker gebruikt Flux Kontext Dev voor tekstgestuurde wijzigingen aan een geüploade afbeelding.",
        modelDescription: "Flux Kontext Dev voor gerichte bewerkingen van een geüploade foto.",
        details: "Afbeelding uploaden · tekstgestuurde wijzigingen · gratis daglimiet",
        cta: "Open de fotobewerker",
      },
      inspiration: {
        title: "Plan de bewerking voordat je die toepast.",
        description: "Zes conceptreferenties om de wijziging, het te behouden gebied en de uiteindelijke sfeer te bepalen. Het zijn bewerkingsreferenties, geen gegenereerde resultaten.",
        items: nlEditInspiration,
      },
      benefits: {
        title: "Houd het oorspronkelijke idee in beeld.",
        items: [
          { title: "Eerst uploaden", text: "Begin met een JPEG-, PNG-, GIF- of WEBP-foto tot 10 MB." },
          { title: "Tekstgestuurde bewerking", text: "Beschrijf de wijziging en houd het hoofdonderwerp duidelijk." },
          { title: "Behoud wat telt", text: "Noem de persoon, het product of het detail dat hetzelfde moet blijven." },
          { title: "Gerichte instellingen", text: "Eén prompt maakt de bewerking eenvoudig te controleren en verfijnen." },
          { title: "Vergelijk het resultaat", text: "Controleer de bewerkte foto met het origineel voordat je downloadt." },
          { title: "In de browser", text: "Upload, bekijk en download in dezelfde fotobewerkingswerkruimte." },
        ],
      },
      process: {
        title: "Van geüploade foto naar doordachte bewerking in drie stappen.",
        steps: [
          { title: "Uploaden", text: "Kies de foto waaraan je wilt werken." },
          { title: "Beschrijven", text: "Noem de wijziging en wat hetzelfde moet blijven." },
          { title: "Bekijken", text: "Controleer het resultaat en download de bewerking die je wilt bewaren." },
        ],
      },
      features: {
        promptTitle: "Een precieze bewerkingsbrief.",
        promptDescription: "Noem het gebied dat moet veranderen, de richting van de bewerking en de details die je wilt behouden. Het voorbeeld helpt je met een duidelijke instructie te beginnen.",
        promptCta: "Probeer een bewerkingsprompt",
        promptPreviewLabel: "Bewerkingsbrief · voorbeeldprompt",
        promptText: "Maak het licht warmer en zachter en houd het onderwerp hetzelfde",
        promptTags: ["Wijziging", "Behoud", "Afwerking"],
        promptNote: "Upload een foto voordat je genereert.",
        workflowTitle: "Houd origineel en bewerking samen.",
        workflowDescription: "Bekijk de bewerkte foto naast het geüploade origineel. Verfijn de instructie als een detail extra aandacht nodig heeft en download daarna het resultaat.",
        workflowCta: "Start een bewerking",
        workflowAlt: "Conceptreferentie voor een zorgvuldig bewerkte fotoscène",
        workflowCaption: "Conceptreferentie · een bewerkingsrichting, geen gegenereerd resultaat",
      },
    },
  },
};

export function getToolPlatformCopy(locale: Locale, toolKind: ToolKind, base: HomePlatformCopy, variant?: "frRetouch" | "freeEdit"): HomePlatformCopy {
  if (toolKind === "image") return base;
  const override = variant === "frRetouch" && locale === "fr" && toolKind === "edit"
    ? frRetouchOverride
    : variant === "freeEdit" && toolKind === "edit"
      ? locale === "fr" ? frFreeEditOverride : locale === "nl" ? nlFreeEditOverride : undefined
      : overrides[locale][toolKind];
  if (!override) return base;

  return {
    ...base,
    tools: { ...base.tools, ...override.tools },
    models: { ...base.models, ...override.models },
    inspiration: { ...base.inspiration, ...override.inspiration },
    benefits: { ...base.benefits, ...override.benefits },
    process: { ...base.process, ...override.process },
    features: { ...base.features, ...override.features },
  };
}
