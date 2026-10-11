import { ABSOLUTE_ROUTES, type Locale, type ToolKind } from "./site";
import { TOOL_CONTENT } from "./tool-content";

export type { ToolKind } from "./site";

export type FaqItem = {
  question: string;
  answer: string;
};

export type LinkItem = {
  href: string;
  label: string;
};

export type ExampleCard = {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
};

export type PageDefinition = {
  key:
    | "en"
    | "it"
    | "fr"
    | "frGenerate"
    | "frEdit"
    | "nl"
    | "nlGenerate"
    | "enVideo"
    | "enEdit"
    | "itImage"
    | "itEdit"
    | "nlVideo"
    | "nlEdit";
  locale: Locale;
  path: string;
  url: string;
  title: string;
  description: string;
  h1: string;
  valueLine: string;
  h2s: readonly [string, string, string, string];
  sectionLeads: readonly [string, string, string];
  /** Additional paragraphs for the first three content sections, rendered after each section's lead. */
  sectionDetails: readonly [readonly [string, string], readonly [string, string], readonly [string, string]];
  faq: readonly [FaqItem, FaqItem, FaqItem];
  steps: readonly [string, string, string];
  useCases: readonly [string, string, string];
  examples: readonly [ExampleCard, ExampleCard, ExampleCard];
  trustPoints: readonly [string, string, string];
  extraLinks?: readonly LinkItem[];
  toolKind: ToolKind;
  isVideo: boolean;
};

const examples = {
  en: [
    { src: "/examples/avatar.webp", width: 960, height: 720, alt: "Illustration of a colorful avatar with a warm gradient background", caption: "Character portrait" },
    { src: "/examples/sneaker.webp", width: 960, height: 720, alt: "Illustration of a white sneaker on a softly lit stone surface", caption: "Product scene" },
    { src: "/examples/landscape.webp", width: 960, height: 720, alt: "Illustration of a quiet mountain landscape under a blue evening sky", caption: "Concept landscape" },
  ],
  it: [
    { src: "/examples/avatar.webp", width: 960, height: 720, alt: "Illustrazione di un avatar colorato su uno sfondo con sfumatura calda", caption: "Ritratto di personaggio" },
    { src: "/examples/sneaker.webp", width: 960, height: 720, alt: "Illustrazione di una scarpa bianca su una superficie in pietra illuminata", caption: "Scena prodotto" },
    { src: "/examples/landscape.webp", width: 960, height: 720, alt: "Illustrazione di un paesaggio montano tranquillo sotto un cielo serale blu", caption: "Paesaggio concept" },
  ],
  fr: [
    { src: "/examples/avatar.webp", width: 960, height: 720, alt: "Illustration d'un avatar coloré sur un dégradé chaleureux", caption: "Portrait de personnage" },
    { src: "/examples/sneaker.webp", width: 960, height: 720, alt: "Illustration d'une chaussure blanche sur une surface minérale douce", caption: "Scène produit" },
    { src: "/examples/landscape.webp", width: 960, height: 720, alt: "Illustration d'un paysage de montagne calme sous un ciel bleu du soir", caption: "Paysage conceptuel" },
  ],
  nl: [
    { src: "/examples/avatar.webp", width: 960, height: 720, alt: "Illustratie van een kleurrijke avatar met een warme verloopachtergrond", caption: "Karakterportret" },
    { src: "/examples/sneaker.webp", width: 960, height: 720, alt: "Illustratie van een witte sneaker op een zacht verlicht stenen oppervlak", caption: "Productscène" },
    { src: "/examples/landscape.webp", width: 960, height: 720, alt: "Illustratie van een rustig berglandschap onder een blauwe avondlucht", caption: "Conceptlandschap" },
  ],
} as const;

export const PAGE_CONTENT: Record<PageDefinition["key"], PageDefinition> = {
  en: {
    key: "en",
    locale: "en",
    path: "/",
    url: ABSOLUTE_ROUTES.en,
    title: "Free AI Image Generator, No Sign Up — Create in Seconds | Ovanto",
    description:
      "Generate AI images right in your browser — no sign-up, no login, no credit card. Type a prompt and get your image in seconds. Free to try.",
    h1: "Free AI Image Generator — No Sign Up, No Login",
    valueLine: "Create a polished image from a clear idea, right in your browser.",
    h2s: [
      "Generate an AI Image in Three Steps",
      "Why Use an Image Generator With No Sign Up",
      "What You Can Create: Avatars, Product Shots, Concept Art",
      "Free AI Image Generator — FAQ",
    ],
    sectionLeads: [
      "Write a short prompt that names the subject, setting, and mood you have in mind. Then review the generated image at a comfortable pace and decide whether the composition communicates the idea. When the direction feels right, use the download action to keep a copy for a pitch, mood board, draft, or personal project. You can revise the wording and try another direction within the available daily allowance. The three steps stay visible so the process feels easy to understand from the first sentence to the final file, even when you are testing a new visual language.",
      "No sign up keeps the first idea lightweight and easy to try. You can move from a blank page to a clear direction without adding an account to the process. That is useful when you are comparing a few visual approaches, checking a rough concept, or preparing a reference before a longer creative session. The browser flow keeps the prompt and result together, so you can focus on the image instead of account settings. A small daily allowance also encourages deliberate experiments: describe one clear idea, learn from the result, and refine the next prompt with a specific change.",
      "Describe a subject, setting, light, and visual mood to give your idea shape. The examples below show the range of scenes you can explore with a focused prompt. An avatar benefits from an expression and framing, while a product scene benefits from a surface, camera distance, and light direction. A landscape becomes easier to guide when you add season, weather, and time of day. Start with the detail that matters most, then add only the context that helps the composition stay coherent. Clear language gives the image a stronger starting point without requiring specialist terms.",
    ],
    sectionDetails: [
      [
        "Begin with the main subject and one action or visual quality. A prompt such as a calm portrait beside a sunlit window gives the image a clear center, while extra details can establish color, framing, and atmosphere without competing for attention.",
        "After the first result, look at the relationship between the subject and the background before changing everything. Adjust one meaningful detail at a time, such as the camera angle or light direction, so each new attempt teaches you something about the direction.",
      ],
      [
        "The no-account flow is also practical for shared work. You can describe a concept on a meeting screen, save a useful direction, and return later with a more specific prompt without creating a profile for a one-off experiment.",
        "A simple browser session leaves room for judgment. The tool helps you make a visual starting point, while you choose which version fits your brief, whether the image belongs in a draft, or whether the idea needs another pass.",
      ],
      [
        "For an avatar, put the face, expression, and crop first. For a product scene, describe the material and the space around the object. For concept art, lead with the place and atmosphere, then add the style that should guide the finish.",
        "The three prompt directions here offer scene ideas to explore. Use them to compare composition and mood, then describe the subject, setting, and light you want in your own prompt.",
      ],
    ],
    faq: [
      {
        question: "Is this AI image generator really free and without sign up?",
        answer:
          "Yes. Start without an account, write a prompt, and create up to 3 images per day per IP.",
      },
      {
        question: "Do I need to create an account to download my image?",
        answer:
          "No. Enter a prompt, generate the image, and download the finished file without creating an account.",
      },
      {
        question: "What can I generate with it?",
        answer:
          "Describe an avatar, product scene, landscape, or other image idea in a prompt, then review and download the result. The image allowance is 3 generations per day per IP.",
      },
    ],
    steps: ["Write a prompt", "Generate", "Download"],
    useCases: [
      "Turn a short idea into a character avatar for a profile, pitch, or story. Name the expression, framing, and mood to make the direction clear. Add clothing, color, or a simple prop when the character needs a recognizable point of view. A concise description usually gives you a better starting point than a list of unrelated adjectives.",
      "Stage a product shot with a defined surface, background, and lighting direction. Specific materials and camera distance help the scene feel intentional. Mention whether the object should feel practical, premium, playful, or minimal so the surrounding choices support the product. You can also describe the empty space you need for a headline or layout.",
      "Explore concept art by describing a place, atmosphere, and visual style. Add a season or time of day when the mood matters to the composition. Consider the viewer's distance and the main shape you want them to notice first. Small cues such as mist, warm windows, or a low horizon can make an imagined setting easier to read.",
    ],
    examples: examples.en,
    trustPoints: ["Free: 3 images/day", "No sign up", "Prompt → Image"],
    toolKind: "image",
    isVideo: false,
  },
  it: {
    key: "it",
    locale: "it",
    path: "/it/",
    url: ABSOLUTE_ROUTES.it,
    title: "Generatore Video AI Gratis Senza Registrazione — Crea Subito | Ovanto",
    description:
      "Genera video con l'AI gratis e senza registrazione. Scrivi il prompt, premi genera e scarica il tuo video in pochi secondi. Nessun account richiesto.",
    h1: "Generatore Video AI Gratis Senza Registrazione",
    valueLine: "Dai forma alla tua idea e prepara un video direttamente dal browser.",
    h2s: [
      "Come Generare un Video con l'AI in 3 Passaggi",
      "Perché Scegliere un Generatore Video AI Senza Registrazione",
      "Cosa Puoi Creare con Ovanto",
      "Domande Frequenti",
    ],
    sectionLeads: [
      "Scrivi un prompt indicando soggetto, ambiente, azione e atmosfera, poi controlla il risultato quando la scena è pronta. Se il movimento o l'inquadratura non seguono l'idea, modifica un dettaglio preciso e prova una nuova direzione. Quando la sequenza comunica ciò che volevi, scarica il file per una presentazione, una bozza o un progetto personale. La sequenza in tre passaggi mantiene il lavoro semplice e leggibile, anche quando stai imparando a descrivere il ritmo di una scena. Parti da un'immagine mentale chiara e lascia che ogni tentativo aggiunga una scelta utile.",
      "Senza registrazione puoi concentrarti sul contenuto prima di creare un account. Il piano gratuito include un video AI 480p di 5 secondi al giorno per IP. Ottieni 3 generazioni video AI Pro per 4,99 USD. Ogni generazione crea un video di 5 secondi con il modello video Pro di Ovanto. È un acquisto una tantum, senza abbonamento né rinnovo automatico. Questo rende facile verificare una direzione per una storia, un prodotto o una presentazione senza preparare un profilo. Il prompt e il risultato restano nello stesso percorso del browser, quindi puoi valutare la scena con calma. Una quota giornaliera contenuta invita a fare prove intenzionali: cambia il soggetto, la luce o il movimento e osserva quale scelta migliora il risultato.",
      "Imposta soggetto, ambiente e movimento per costruire una scena leggibile. Puoi partire da un concept, una clip prodotto o un momento narrativo. Indica il punto di vista, la velocità percepita e ciò che deve restare fermo mentre la scena cambia. Per un prodotto, specifica la superficie e la direzione della luce; per un racconto, aggiungi l'emozione e il gesto principale. Dettagli concreti aiutano a mantenere il focus senza trasformare il prompt in un elenco confuso. Prima definisci il centro della scena, poi aggiungi il contesto che rende credibile l'azione.",
    ],
    sectionDetails: [
      [
        "Inizia con una frase breve che contiene il soggetto e l'azione. Una persona che attraversa una piazza bagnata dalla pioggia è più facile da orientare di una lista di parole scollegate; dopo puoi precisare colore, luce e distanza della camera.",
        "Osserva prima il movimento generale e poi i dettagli. Se il risultato è troppo statico, descrivi un gesto o una traiettoria; se è confuso, riduci gli elementi secondari e lascia più spazio al soggetto principale.",
      ],
      [
        "L'assenza di registrazione è utile anche per un confronto veloce con un collega. Puoi mostrare una prima direzione, annotare cosa non funziona e tornare al prompt senza aggiungere dati personali a un progetto temporaneo.",
        "Il browser diventa così un punto di partenza pratico per una sceneggiatura o una moodboard. La scelta finale resta tua: il risultato aiuta a discutere ritmo e atmosfera, ma non sostituisce la revisione creativa.",
      ],
      [
        "Una clip prodotto può richiedere un movimento lento e regolare per rendere leggibili forma e materiale. Una scena narrativa può invece richiedere un gesto breve, uno sguardo o un cambio di luce che segnali il momento importante.",
        "Queste tre direzioni di prompt suggeriscono scene da esplorare. Usale per confrontare composizione e atmosfera, poi descrivi nel tuo prompt il soggetto, l'ambiente e la luce che desideri.",
      ],
    ],
    faq: [
      {
        question: "Il generatore video AI è davvero gratis e senza registrazione?",
        answer:
          "Sì. Puoi scrivere un prompt senza registrazione e generare 1 video AI al giorno per IP, con durata di 5 secondi e risoluzione 480p.",
      },
      {
        question: "Devo creare un account per scaricare il video?",
        answer:
          "No. Scrivi il prompt, genera il video e scarica il file completato senza creare un account.",
      },
      {
        question: "Cosa succede dopo aver usato il video gratuito?",
        answer:
          "Ogni IP può creare gratuitamente 1 video AI di 5 secondi in 480p al giorno. Quando il pagamento sarà disponibile, potrai acquistare un Ovanto Pro Video Pack da 4,99 USD, che include 3 generazioni video Pro. È un acquisto una tantum, senza abbonamento né rinnovo automatico.",
      },
    ],
    steps: ["Scrivi il prompt", "Genera", "Scarica"],
    useCases: [
      "Presenta un'idea con una scena breve, un soggetto chiaro e un movimento definito. Specifica l'atmosfera per rendere il ritmo più leggibile. Aggiungi un gesto essenziale o una variazione di luce quando vuoi che lo spettatore capisca il momento principale.",
      "Prepara una clip per un prodotto indicando inquadratura, luce e ritmo. Una descrizione concreta aiuta a mantenere il prodotto al centro. Puoi anche indicare la superficie, la distanza della camera e lo spazio libero che servirà a un titolo.",
      "Esplora un concept visivo con ambiente, punto di vista e stile. Puoi aggiungere una stagione o un'azione per orientare la scena. Un dettaglio sensoriale, come nebbia, vento o luce calda, aiuta a rendere l'atmosfera più coerente.",
    ],
    examples: examples.it,
    trustPoints: ["Gratis: 1 video AI al giorno", "5 secondi · 480p", "3 video Pro per 4,99 USD"],
    toolKind: "video",
    isVideo: true,
  },
  fr: {
    key: "fr",
    locale: "fr",
    path: "/fr/",
    url: ABSOLUTE_ROUTES.fr,
    title: "Générateur de Vidéo IA Gratuit Sans Inscription — Créez Maintenant | Ovanto",
    description:
      "Générez des vidéos avec l'IA gratuitement et sans inscription. Écrivez votre prompt, lancez la génération et téléchargez votre vidéo en quelques secondes.",
    h1: "Générateur de Vidéo IA Gratuit Sans Inscription",
    valueLine: "Donnez vie à votre idée et préparez une vidéo directement dans le navigateur.",
    h2s: [
      "Comment Générer une Vidéo IA en 3 Étapes",
      "Pourquoi Choisir un Générateur de Vidéo IA Sans Inscription",
      "Ce Que Vous Pouvez Créer",
      "Questions Fréquentes",
    ],
    sectionLeads: [
      "Écrivez un prompt qui précise le sujet, le décor, le mouvement et l'atmosphère, puis vérifiez la scène lorsqu'elle est prête. Si le rythme ou le cadrage ne correspondent pas à votre idée, modifiez un détail précis et relancez une direction. Lorsque la séquence devient claire, téléchargez le fichier pour une présentation, une maquette ou un projet personnel. Les trois étapes restent faciles à suivre, même lorsque vous apprenez à décrire un mouvement. Commencez par l'intention principale et laissez chaque essai vous aider à affiner la scène.",
      "Sans inscription, vous pouvez vous concentrer sur votre idée avant de créer un compte. Le forfait gratuit inclut une vidéo IA 480p de 5 secondes par jour et par IP. Obtenez 3 générations de vidéos IA Pro pour 4,99 $US. Chaque génération crée une vidéo de 5 secondes avec le modèle vidéo Pro d'Ovanto. Il s'agit d'un achat unique, sans abonnement ni renouvellement automatique. Vous pouvez ainsi tester une direction pour un récit, un produit ou une présentation sans préparer de profil. Le prompt et le résultat restent dans le même parcours du navigateur, ce qui laisse la place à une décision créative réfléchie. Une petite limite quotidienne encourage des essais précis : changez le sujet, la lumière ou le mouvement et observez ce qui améliore la scène.",
      "Décrivez le sujet, le décor et le mouvement pour construire une scène lisible. Vous pouvez partir d'un concept, d'un produit ou d'un moment narratif. Ajoutez le point de vue, la vitesse ressentie et l'élément qui doit rester stable pendant l'action. Pour un produit, indiquez la surface et la direction de la lumière ; pour un récit, précisez l'émotion et le geste central. Les détails concrets gardent le regard sur le sujet sans transformer le prompt en liste confuse. Définissez d'abord le centre de la scène, puis le contexte qui rend l'action crédible.",
    ],
    sectionDetails: [
      [
        "Commencez par une phrase qui associe le sujet et l'action. Une personne qui traverse une place sous la pluie donne une direction plus nette qu'une suite de mots isolés ; vous pouvez ensuite préciser la couleur, la lumière et la distance de la caméra.",
        "Regardez d'abord le mouvement général, puis les détails. Si le résultat paraît immobile, ajoutez un geste ou une trajectoire ; s'il paraît confus, réduisez les éléments secondaires et laissez davantage d'espace au sujet principal.",
      ],
      [
        "L'absence d'inscription convient aussi à une comparaison rapide avec un collègue. Vous pouvez montrer une première direction, noter ce qui doit changer et revenir au prompt sans ajouter de données personnelles à un essai ponctuel.",
        "Le navigateur devient un point de départ pratique pour une maquette ou une planche d'ambiance. Le choix final vous appartient : le résultat aide à discuter le rythme et l'atmosphère, sans remplacer votre révision créative.",
      ],
      [
        "Une scène produit demande souvent un mouvement lent et régulier pour rendre la forme et la matière lisibles. Une scène narrative peut plutôt s'appuyer sur un geste bref, un regard ou un changement de lumière qui signale le moment important.",
        "Ces trois directions de prompt suggèrent des scènes à explorer. Comparez la composition et la lumière, puis décrivez dans votre propre prompt le sujet et l'atmosphère souhaités.",
      ],
    ],
    faq: [
      {
        question: "Le générateur de vidéo IA est-il vraiment gratuit et sans inscription ?",
        answer:
          "Oui. Écrivez un prompt sans inscription et générez 1 vidéo IA par jour et par IP, en 5 secondes et 480p.",
      },
      {
        question: "Faut-il un compte pour télécharger la vidéo ?",
        answer:
          "Non. Écrivez le prompt, générez la vidéo et téléchargez le fichier terminé sans créer de compte.",
      },
      {
        question: "Que se passe-t-il après avoir utilisé ma vidéo gratuite ?",
        answer:
          "Chaque IP peut créer gratuitement 1 vidéo IA de 5 secondes en 480p par jour. Lorsque le paiement sera disponible, vous pourrez acheter un Ovanto Pro Video Pack à 4,99 $US, comprenant 3 générations de vidéos Pro. Il s'agit d'un achat unique, sans abonnement ni renouvellement automatique.",
      },
    ],
    steps: ["Écrivez le prompt", "Générez", "Téléchargez"],
    useCases: [
      "Présentez une idée avec une scène courte, un sujet clair et un mouvement défini. Ajoutez l'atmosphère pour guider le rythme de la séquence. Précisez un geste essentiel ou une variation de lumière si le spectateur doit comprendre un moment précis.",
      "Préparez un clip produit en indiquant le cadrage, la lumière et le rythme. Une consigne concrète garde le produit au centre de la scène. Vous pouvez aussi préciser la matière, la surface et l'espace libre prévu pour un titre.",
      "Explorez un concept visuel en décrivant le décor, le point de vue et le style. Vous pouvez préciser une saison ou une action pour orienter la scène. Un détail sensoriel comme la brume, le vent ou une lumière chaude aide à stabiliser l'atmosphère.",
    ],
    examples: examples.fr,
    trustPoints: ["Gratuit : 1 vidéo IA/jour", "5 secondes · 480p", "3 vidéos Pro pour 4,99 $US"],
    extraLinks: [
      { href: "/fr/photo-ia-gratuit", label: "Photo IA gratuit" },
      { href: "/fr/modifier-photo-ia", label: "Modifier photo IA" },
    ],
    toolKind: "video",
    isVideo: true,
  },
  frGenerate: {
    key: "frGenerate",
    locale: "fr",
    path: "/fr/photo-ia-gratuit",
    url: ABSOLUTE_ROUTES.frGenerate,
    title: "Photo IA Gratuit — Générez Vos Images en Ligne | Ovanto",
    description:
      "Photo IA gratuit : décrivez votre idée et générez une image en ligne, sans inscription. Idéal pour avatars, visuels produits et illustrations.",
    h1: "Photo IA Gratuit : Générez Vos Images en Ligne",
    valueLine: "Décrivez une idée et préparez une image en ligne, sans inscription.",
    h2s: [
      "Générez une Photo IA Gratuitement, Sans Inscription",
      "Idées de Photos à Générer : Avatars, Produits, Paysages",
      "Comment Obtenir un Meilleur Résultat (Prompts)",
      "Questions Fréquentes",
    ],
    sectionLeads: [
      "Décrivez un sujet, vérifiez le résultat et téléchargez votre image lorsqu'elle est prête. Un parcours court vous permet de rester concentré sur l'idée, sans vous perdre dans des réglages secondaires. Commencez par le sujet principal, observez la composition, puis ajustez un détail qui compte vraiment si l'image ne suit pas votre intention. Lorsque la direction est convaincante, gardez le fichier pour une maquette, une présentation ou un projet personnel. Les trois étapes forment une méthode claire pour passer d'une phrase à une image lisible, même lorsque vous explorez un style pour la première fois.",
      "Sans inscription, vous pouvez tester une direction visuelle rapidement. Le quota gratuit comprend 3 images par jour et 1 vidéo 480p de 5 secondes par jour et par IP. Cette approche convient à une idée ponctuelle, à une recherche de référence ou à une première proposition pour une équipe. Le prompt et l'image restent dans le même parcours du navigateur, ce qui permet de comparer les choix avec attention. Une limite quotidienne modeste aide à formuler des demandes précises et à apprendre de chaque résultat.",
      "Précisez le sujet, le cadrage, la lumière et le style pour guider l'image. Les détails concrets donnent au prompt une intention plus facile à suivre. Ajoutez la matière, la distance de la caméra et la relation entre le sujet et l'arrière-plan si la composition doit rester précise. Un avatar gagne à préciser l'expression et la silhouette ; un produit gagne à préciser la surface et la source de lumière ; un paysage gagne à préciser la saison et la météo. Définissez d'abord ce qui doit attirer le regard, puis ajoutez le contexte utile.",
    ],
    sectionDetails: [
      [
        "Commencez par une phrase qui associe un sujet et une scène. Un portrait près d'une fenêtre éclairée donne un point de départ plus net qu'une suite d'adjectifs ; vous pouvez ensuite préciser les couleurs, la distance et l'ambiance.",
        "Examinez d'abord la place du sujet dans l'image. Si la composition manque de clarté, changez le cadrage ou le fond avant de réécrire toute la demande. Un seul ajustement à la fois rend les essais plus faciles à comparer.",
      ],
      [
        "L'utilisation sans inscription facilite aussi une discussion rapide. Vous pouvez présenter une direction, garder une référence et revenir au texte sans créer de profil pour une idée temporaire ou une réunion ponctuelle.",
        "La simplicité du navigateur laisse la décision visuelle entre vos mains. Le résultat fournit une base de discussion pour une maquette, une présentation ou une exploration personnelle, puis vous choisissez ce qui mérite d'être conservé.",
      ],
      [
        "Pour un avatar, placez le visage, l'expression et le cadrage au début. Pour un produit, indiquez la matière, la surface et l'espace autour de l'objet. Pour un paysage, commencez par le lieu, la lumière et la météo avant de préciser le style.",
        "Ces trois directions de prompt suggèrent des sujets et des compositions possibles. Servez-vous-en pour imaginer la scène, puis décrivez votre propre sujet, cadrage et lumière dans le prompt.",
      ],
    ],
    faq: [
      {
        question: "Comment créer une photo IA sans inscription ?",
        answer:
          "Décrivez l'image dans un prompt et lancez la génération sans inscription. Vous pouvez créer jusqu'à 3 images par jour et par IP, puis télécharger le résultat.",
      },
      {
        question: "Quels types d'images puis-je créer ?",
        answer:
          "Vous pouvez décrire un avatar, un visuel produit, un paysage ou toute autre idée d'image dans un prompt, puis télécharger le résultat.",
      },
      {
        question: "Comment écrire un meilleur prompt ?",
        answer:
          "Indiquez le sujet, le cadrage, la lumière et le style. Commencez par l'élément principal, ajustez un détail à la fois, puis téléchargez la version qui vous convient.",
      },
    ],
    steps: ["Écrivez le prompt", "Générez", "Téléchargez"],
    useCases: [
      "Imaginez un avatar avec une expression, un cadrage et un style visuel précis. Un détail sur la lumière aide à garder le portrait cohérent. Vous pouvez ajouter un vêtement, une couleur ou un objet simple pour donner au personnage un repère reconnaissable.",
      "Présentez un produit en décrivant la matière, le décor et la lumière. Ajoutez le point de vue pour mieux organiser la scène. Indiquez l'espace vide à conserver si l'image doit accueillir un titre, une fiche ou une présentation.",
      "Composez un paysage en indiquant la saison, l'ambiance et le point de vue. Les couleurs et la météo renforcent l'atmosphère choisie. Une brume légère, une ligne d'horizon ou une source de lumière précise peut aider à donner une structure au décor.",
    ],
    examples: examples.fr,
    trustPoints: ["Gratuit : 3 images/jour", "Sans inscription", "Prompt → Image"],
    extraLinks: [{ href: "/fr/modifier-photo-ia", label: "Modifier photo IA" }],
    toolKind: "image",
    isVideo: false,
  },
  frEdit: {
    key: "frEdit",
    locale: "fr",
    path: "/fr/modifier-photo-ia",
    url: ABSOLUTE_ROUTES.frEdit,
    title: "Modifier Photo IA — Retouche et Édition en Ligne | Ovanto",
    description:
      "Modifiez vos photos avec l'IA : retirez l'arrière-plan, changez le style, améliorez la lumière et retouchez vos portraits en ligne, sans inscription.",
    h1: "Modifier Photo IA en Ligne",
    valueLine: "Préparez une retouche photo claire et naturelle, directement en ligne.",
    h2s: [
      "Modifier une Photo avec l'IA en Ligne",
      "Retirer l'Arrière-Plan et Changer le Fond",
      "Améliorer et Retoucher un Portrait",
      "Questions Fréquentes",
    ],
    sectionLeads: [
      "Téléversez une image, décrivez la transformation souhaitée et vérifiez chaque détail avant de télécharger le résultat. Le parcours garde le sujet et l'intention visuelle au centre : indiquez ce qui doit rester intact, puis nommez la zone ou l'atmosphère à changer. Une consigne structurée donne au modèle un point de départ clair et vous aide à juger la composition avec attention. Vous pouvez conserver le fichier pour une maquette, une présentation ou un projet personnel après avoir vérifié les contours, la lumière et les textures.",
      "Un fond plus propre peut clarifier un produit ou un portrait. Décrivez le sujet à conserver, l'ambiance et la lumière, puis précisez les contours importants pour un détourage ou un nouveau contexte. Pour un changement de fond, indiquez la profondeur, les couleurs et les ombres qui doivent rester cohérentes avec le sujet. Pour un style différent, décrivez l'intensité souhaitée et les éléments qui doivent garder leur matière, afin que chaque action reste lisible avant le téléchargement.",
      "Précisez la lumière, le contraste et le rendu naturel recherchés pour guider le résultat. Pour un portrait, notez les traits, l'expression et la texture qui doivent rester reconnaissables avant de décrire l'ambiance. Pour une image de produit, indiquez la matière, les reflets et l'orientation de la source lumineuse. Cette méthode vous aide à comparer le fichier original et le résultat avec un regard précis, puis à retenir la version qui correspond à votre besoin.",
    ],
    sectionDetails: [
      [
        "Commencez par distinguer le sujet à préserver de la zone à transformer. Une consigne comme conserver le visage et modifier uniquement le décor donne une intention plus claire qu'une demande générale de changement.",
        "Ajoutez ensuite le résultat visuel recherché : lumière douce, fond neutre, couleur précise ou contraste réduit. Ces indications donnent au traitement une direction concrète et rendent la comparaison avec l'original plus simple.",
      ],
      [
        "Un arrière-plan crédible dépend de la relation entre le sujet, la lumière et la profondeur. Notez la direction des ombres et la température des couleurs pour que le futur rendu puisse rester naturel autour du produit ou du portrait.",
        "Lorsque le fond doit disparaître, décrivez les contours difficiles comme les cheveux, les transparences ou les objets fins. Cette précision aide à définir le besoin avant de choisir une méthode de modification adaptée.",
      ],
      [
        "Pour une lumière plus équilibrée, indiquez ce qui doit rester naturel : le teint, les volumes, les détails du regard ou la texture d'un vêtement. Décrivez l'intensité souhaitée plutôt qu'un changement total de style.",
        "Ces trois pistes de prompt suggèrent des compositions à observer avant une retouche. Elles vous aident à préciser le cadrage et la lumière, puis à décrire les éléments à préserver dans votre propre consigne.",
      ],
    ],
    faq: [
      {
        question: "Comment modifier une photo avec l'IA en ligne ?",
        answer:
          "Téléversez une image JPEG, PNG, GIF ou WEBP de 10 Mo maximum. Indiquez le sujet à préserver et la zone à modifier, comparez l'original et le résultat, puis téléchargez la version finale. Le quota est de 1 modification par jour et par IP.",
      },
      {
        question: "Puis-je retirer un arrière-plan sans inscription ?",
        answer:
          "Oui. Téléversez une image de 10 Mo maximum, précisez les éléments à conserver et décrivez le nouveau fond, puis vérifiez l'avant et l'après avant de télécharger.",
      },
      {
        question: "Comment améliorer la lumière d'un portrait ?",
        answer:
          "Téléversez le portrait, indiquez la direction et l'intensité de la lumière, puis nommez les traits et les textures à préserver. Comparez l'avant et l'après avant de télécharger le résultat.",
      },
    ],
    steps: ["Décrivez la retouche", "Vérifiez", "Téléchargez"],
    useCases: [
      "Retirez un arrière-plan en précisant le sujet à conserver et le nouveau décor. Une lumière cohérente aide la scène à rester naturelle. Notez les contours délicats, les ombres et les éléments transparents qui demandent une attention particulière.",
      "Changez l'ambiance d'une photo avec une couleur, une texture ou un style ciblé. Décrivez l'intensité pour garder le rendu crédible. Une demande qui indique ce qui doit rester intact aide à séparer l'atmosphère du sujet principal.",
      "Améliorez un portrait en indiquant la lumière et le rendu naturel recherchés. Des consignes simples préservent les traits et l'expression. Précisez le contraste, la direction de la lumière et la texture de la peau si ces détails comptent pour le résultat.",
    ],
    examples: examples.fr,
    trustPoints: ["Gratuit : 1 modification/jour", "Sans inscription", "Avant / Après"],
    extraLinks: [{ href: "/fr/photo-ia-gratuit", label: "Photo IA gratuit" }],
    toolKind: "edit",
    isVideo: false,
  },
  nl: {
    key: "nl",
    locale: "nl",
    path: "/nl/",
    url: ABSOLUTE_ROUTES.nl,
    title: "AI Afbeelding Maken Gratis — Zonder Account | Ovanto",
    description:
      "Maak gratis een AI afbeelding zonder account. Typ je prompt, genereer en download je afbeelding binnen enkele seconden. Geen registratie nodig.",
    h1: "AI Afbeelding Maken Gratis",
    valueLine: "Beschrijf je idee en maak een helder beeld direct in je browser.",
    h2s: [
      "In 3 Stappen een AI Afbeelding Maken",
      "Waarom Zonder Account Werken Fijn Is",
      "Wat Je Kunt Maken met Ovanto",
      "Veelgestelde Vragen",
    ],
    sectionLeads: [
      "Schrijf een prompt met het onderwerp, de omgeving en de sfeer die je voor ogen hebt. Bekijk daarna rustig het resultaat en download het zodra de compositie bij je idee past. Als een detail niet klopt, verander dan één keuze tegelijk, zoals het licht, de uitsnede of de achtergrond. Zo leer je van iedere poging zonder het hele concept opnieuw te schrijven. De drie stappen blijven overzichtelijk, van de eerste zin tot het bestand dat je kunt bewaren voor een presentatie, concept of persoonlijk project.",
      "Zonder account kun je direct beginnen met een eerste idee. De gratis bundel bevat 3 afbeeldingen per dag per IP en 1 video van 480p/5 seconden per dag per IP. Dat is handig wanneer je een richting wilt testen, een beeld voor een overleg nodig hebt of eerst wilt zien welke stijl bij je onderwerp past. Prompt en resultaat blijven in dezelfde browserstroom, zodat je kunt beoordelen wat werkt zonder profielinstellingen. Een kleine daglimiet moedigt duidelijke, gerichte prompts aan.",
      "Noem een onderwerp, setting en visuele stijl om je idee vorm te geven. Je kunt starten met een avatar, productbeeld, landschap of illustratie. Beschrijf voor een avatar de uitdrukking en uitsnede; voor een product de ondergrond, materialen en lichtbron; voor een landschap het seizoen en tijdstip. Begin met het belangrijkste onderwerp en voeg daarna alleen details toe die de compositie begrijpelijker maken. Een concrete beschrijving geeft het beeld houvast zonder specialistische termen nodig te hebben.",
    ],
    sectionDetails: [
      [
        "Begin met één zin waarin onderwerp en beeldsituatie samenkomen. Een portret bij een verlicht raam geeft meer richting dan een losse lijst bijvoeglijke naamwoorden; daarna kun je kleur, afstand en sfeer verder bepalen. Zo blijft het belangrijkste onderwerp herkenbaar voordat je extra stijl toevoegt.",
        "Kijk eerst naar de plaats van het onderwerp in het beeld. Wanneer de compositie niet helder is, verander dan de uitsnede of achtergrond voordat je alles herschrijft. Eén wijziging per poging maakt het verschil beter zichtbaar.",
      ],
      [
        "Geen account gebruiken is ook praktisch bij kort overleg. Je kunt een eerste richting tonen, een keuze vastleggen en later teruggaan naar de prompt zonder gegevens aan een tijdelijk project te koppelen.",
        "De browser houdt de beslissing bij jou. Het resultaat geeft een startpunt voor een concept of presentatie, waarna je zelf kiest welke versie past en welke details nog een nieuwe poging verdienen. Die rustige keuze helpt om een eerste idee praktisch te maken.",
      ],
      [
        "Een productbeeld wordt duidelijker wanneer materiaal, oppervlak en camerastandpunt samen worden genoemd. Bij een landschap helpen horizon, weer en licht om de ruimte rustig en herkenbaar te maken. Beschrijf eerst de grote vormen en voeg pas daarna kleine accenten toe.",
        "Deze drie prompt-richtingen geven scènes om te verkennen. Vergelijk compositie en sfeer en beschrijf daarna in je eigen prompt het onderwerp, de omgeving en het licht.",
      ],
    ],
    faq: [
      {
        question: "Kan ik gratis een AI-afbeelding maken zonder account?",
        answer:
          "Ja. Schrijf een prompt zonder account en maak tot 3 afbeeldingen per dag per IP.",
      },
      {
        question: "Heb ik een account nodig om mijn afbeelding te downloaden?",
        answer:
          "Nee. Beschrijf de afbeelding in een prompt, genereer haar en download het voltooide bestand zonder een afbeelding te uploaden of een account te maken.",
      },
      {
        question: "Welke afbeeldingen kan ik maken?",
        answer:
          "Beschrijf een avatar, productbeeld, landschap of ander beeldidee in een prompt en download het resultaat. De afbeeldingslimiet is 3 generaties per dag per IP.",
      },
    ],
    steps: ["Schrijf een prompt", "Genereren", "Downloaden"],
    useCases: [
      "Maak een avatar door onderwerp, uitsnede, uitdrukking en stijl te beschrijven. Voeg licht toe als de sfeer van het portret belangrijk is. Een kledingdetail of eenvoudig object kan het personage een herkenbaar uitgangspunt geven.",
      "Toon een product met materiaal, ondergrond, achtergrond en licht. Een duidelijk standpunt helpt om de scène rustig te houden. Benoem ook welke lege ruimte nodig is voor een titel of korte producttekst.",
      "Verken een landschap met seizoen, sfeer, kleuren en perspectief. Benoem het tijdstip als de lucht en het licht de compositie sturen. Mist, wind of een lage horizon kan de ruimte een duidelijke richting geven.",
    ],
    examples: examples.nl,
    trustPoints: ["Gratis: 3 afbeeldingen per dag", "Geen registratie", "Prompt → Afbeelding"],
    extraLinks: [{ href: "/nl/afbeeldingen-maken-met-ai", label: "Afbeeldingen maken met AI" }],
    toolKind: "image",
    isVideo: false,
  },
  nlGenerate: {
    key: "nlGenerate",
    locale: "nl",
    path: "/nl/afbeeldingen-maken-met-ai",
    url: ABSOLUTE_ROUTES.nlGenerate,
    title: "Afbeeldingen Maken Met AI — Online Generator | Ovanto",
    description:
      "Afbeeldingen maken met AI: kies een stijl, beschrijf je idee en genereer online afbeeldingen. Gratis, zonder account.",
    h1: "Afbeeldingen Maken Met AI",
    valueLine: "Kies een stijl, beschrijf je idee en maak online een beeld.",
    h2s: [
      "Afbeeldingen Maken Met AI: Zo Werkt Het",
      "Stijlen en Voorbeelden",
      "Tips voor Betere Resultaten",
      "Veelgestelde Vragen",
    ],
    sectionLeads: [
      "Beschrijf je idee, bekijk het resultaat en download de afbeelding wanneer die klaar is. De stappen blijven overzichtelijk, van prompt tot bestand, zodat je eerst de richting kunt beoordelen voordat je verder werkt. Als het beeld niet precies aansluit, wijzig dan één keuze, bijvoorbeeld de stijl, de uitsnede of het licht. Zo wordt elke nieuwe poging informatief in plaats van willekeurig. De korte volgorde helpt bij een eerste concept, een presentatie of een visuele referentie die je later wilt bewaren.",
      "Een duidelijke stijlkeuze helpt om het gewenste beeld af te bakenen. De gratis bundel bevat 3 afbeeldingen per dag per IP en 1 video van 480p/5 seconden per dag per IP. Zonder account kun je een eerste richting snel testen voor een overleg, een concept of een persoonlijk project. Prompt en resultaat blijven in dezelfde browserstroom, waardoor je kunt vergelijken zonder profielinstellingen. De dagelijkse hoeveelheid is bewust overzichtelijk: schrijf een duidelijke vraag, beoordeel het beeld en verbeter daarna één relevant detail.",
      "Noem onderwerp, compositie, licht, kleuren en stijl voor een gerichte prompt. Concrete details maken het eenvoudiger om je bedoeling te volgen. Begin met het element dat de kijker als eerste moet zien en beschrijf daarna de ruimte eromheen. Een product vraagt vaak om materiaal en camerastandpunt, een avatar om expressie en uitsnede, en een landschap om seizoen, weer en horizon. Met een heldere volgorde blijft de prompt leesbaar en krijgt de afbeelding een samenhangend uitgangspunt.",
    ],
    sectionDetails: [
      [
        "Begin met onderwerp en situatie in één zin. Een stille werktafel bij ochtendlicht geeft een duidelijk vertrekpunt; daarna kun je kleuren, afstand en stijl toevoegen zonder de hoofdgedachte te verliezen. Hierdoor blijft duidelijk wat de kijker eerst moet zien.",
        "Bekijk eerst de compositie voordat je kleine details beoordeelt. Als het onderwerp niet genoeg ruimte krijgt, verander dan de uitsnede of achtergrond. Eén gerichte wijziging per poging maakt het resultaat eenvoudiger te vergelijken.",
      ],
      [
        "Geen account nodig hebben is handig wanneer je kort wilt overleggen. Je kunt een richting tonen, de bruikbare versie bewaren en later terugkomen zonder gegevens aan een tijdelijk concept te koppelen.",
        "De browserstroom houdt de creatieve keuze eenvoudig. Het beeld is een startpunt voor een ontwerp of gesprek; jij bepaalt welke versie past en welke aanwijzing nog scherper moet worden. Zo blijft het proces bruikbaar voor een korte of langere verkenning.",
      ],
      [
        "Een stijl wordt duidelijker wanneer je ook licht, materiaal en afstand noemt. Voor een illustratie helpt een kleurpalet, voor een product helpt een oppervlak, en voor een landschap helpen weer en tijdstip. Deze volgorde maakt het eenvoudiger om prioriteiten in je prompt te bewaren.",
        "Deze drie prompt-richtingen geven mogelijke onderwerpen en composities. Gebruik ze als aanleiding om je scène te bedenken en beschrijf daarna je eigen onderwerp, kader en licht.",
      ],
    ],
    faq: [
      {
        question: "Hoe kan ik afbeeldingen maken met AI?",
        answer:
          "Beschrijf je idee in een prompt en genereer de afbeelding zonder account. Je kunt tot 3 afbeeldingen per dag per IP maken en daarna downloaden.",
      },
      {
        question: "Welke stijlen en voorbeelden kan ik gebruiken?",
        answer:
          "Beschrijf zonder account een productbeeld, avatar, landschap of illustratie en voeg de gewenste stijl toe. Bekijk het resultaat en download het wanneer het past.",
      },
      {
        question: "Hoe krijg ik betere resultaten?",
        answer:
          "Noem onderwerp, compositie, licht, kleuren en stijl. Begin met het belangrijkste element, wijzig één detail per poging en download de bruikbare versie.",
      },
    ],
    steps: ["Beschrijf je idee", "Genereren", "Downloaden"],
    useCases: [
      "Kies een stijl en beschrijf een onderwerp voor een helder eerste concept. Voeg een compositie toe als de indeling belangrijk is. Benoem ook het belangrijkste contrast of de kleur die de kijker als eerste moet opmerken.",
      "Werk een productbeeld uit met een concrete setting, lichtbron en camerastandpunt. Materiaal en kleur maken de presentatie specifieker. Laat ruimte vrij wanneer het beeld later naast een titel of producttekst komt te staan.",
      "Maak een illustratie door sfeer, kleuren en compositie te benoemen. Een duidelijk referentiepunt helpt om de scène samenhangend te houden. Een seizoen, lichtbron of eenvoudige actie kan de gekozen stijl meer richting geven.",
    ],
    examples: examples.nl,
    trustPoints: ["Gratis: 3 afbeeldingen per dag", "Geen registratie", "Prompt → Afbeelding"],
    extraLinks: [{ href: "/nl/", label: "AI afbeelding maken gratis" }],
    toolKind: "image",
    isVideo: false,
  },
  ...TOOL_CONTENT,
};
