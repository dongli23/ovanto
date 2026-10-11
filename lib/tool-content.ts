import type { PageDefinition } from "./content";
import { ABSOLUTE_ROUTES, ROUTES } from "./site";

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
  nl: [
    { src: "/examples/avatar.webp", width: 960, height: 720, alt: "Illustratie van een kleurrijke avatar met een warme verloopachtergrond", caption: "Karakterportret" },
    { src: "/examples/sneaker.webp", width: 960, height: 720, alt: "Illustratie van een witte sneaker op een zacht verlicht stenen oppervlak", caption: "Productscène" },
    { src: "/examples/landscape.webp", width: 960, height: 720, alt: "Illustratie van een rustig berglandschap onder een blauwe avondlucht", caption: "Conceptlandschap" },
  ],
} as const;

type ToolPageKey = "enVideo" | "enEdit" | "itImage" | "itEdit" | "nlVideo" | "nlEdit";

export const TOOL_CONTENT: Record<ToolPageKey, PageDefinition> = {
  enVideo: {
    key: "enVideo",
    locale: "en",
    path: ROUTES.enVideo,
    url: ABSOLUTE_ROUTES.enVideo,
    title: "Free AI Video Generator, No Sign Up — Create Short Videos | Ovanto",
    description:
      "Create a short AI video in your browser without signing up. Describe the subject and movement, generate a 5-second clip, and download the result.",
    h1: "Free AI Video Generator — No Sign Up",
    valueLine: "Turn a clear idea into a short video directly in your browser.",
    h2s: [
      "How to Generate a Short AI Video in 3 Steps",
      "Why Use an AI Video Generator Without Sign Up",
      "What You Can Create with AI Video",
      "Free AI Video Generator — FAQ",
    ],
    sectionLeads: [
      "Write a prompt that names the subject, setting, movement, and mood you have in mind. Review the finished scene, then adjust one meaningful detail if the pacing or camera view misses the idea. When the sequence feels clear, download the file for a presentation, storyboard, draft, or personal project. The three steps stay visible from the first sentence to the final clip, so you can learn from each attempt while keeping the creative direction easy to follow.",
      "No sign up keeps the first video idea lightweight. You can test a scene before adding an account or preparing a full production workflow. The free allowance includes one 5-second, 480p AI video per day per IP. You can also get 3 Pro AI video generations for 4.99 USD as a one-time purchase, with no subscription or automatic renewal. A short browser flow makes it practical to compare a few ideas and decide which direction deserves more work.",
      "Describe a subject, a place, and a visible action to give the scene a strong center. A product clip benefits from a defined surface, camera distance, and light direction. A narrative moment benefits from a gesture, point of view, and emotional tone. A concept scene becomes easier to read when you add weather, time of day, or a change in the background. Start with the movement that matters most, then add only the context that helps the shot stay coherent.",
    ],
    sectionDetails: [
      [
        "Begin with one sentence that connects the subject and the action. A cyclist crossing a quiet bridge at sunrise gives the motion a clear purpose, while color, framing, and atmosphere can be added afterward without competing for attention.",
        "Watch the overall movement before changing small details. If the result feels static, add a gesture or a simple camera move. If the scene feels crowded, remove secondary elements and give the main subject more space.",
      ],
      [
        "A browser session is useful when you are comparing a few directions with a colleague. You can show a first clip, note what needs to change, and return to the prompt without creating a profile for a one-off idea.",
        "The result is a visual starting point for a pitch, mood board, or story discussion. You decide which take fits the brief and whether the scene needs another pass before it becomes part of a larger project.",
      ],
      [
        "For a product, describe how the camera should move around the material and what should remain in focus. For a story beat, describe the gesture and the moment the viewer should notice. For concept art, set the place and atmosphere before adding a visual style.",
        "Use the three scene directions below to compare rhythm, framing, and light. Then describe the subject, setting, and movement you want to explore in your own prompt.",
      ],
    ],
    faq: [
      {
        question: "Is this AI video generator free and without sign up?",
        answer:
          "Yes. Start without an account and create 1 AI video per day per IP. The free video is 5 seconds long and rendered at 480p.",
      },
      {
        question: "Do I need an account to download my video?",
        answer:
          "No. Write a prompt, generate the clip, and download the completed file without creating an account.",
      },
      {
        question: "What happens after I use the free video?",
        answer:
          "Each IP can create 1 free 5-second 480p AI video per day. You can also purchase an Ovanto Pro Video Pack for 4.99 USD with 3 Pro generations as a one-time purchase, without a subscription or automatic renewal.",
      },
    ],
    steps: ["Write a prompt", "Generate", "Download"],
    useCases: [
      "Show an idea with a short scene, a clear subject, and one defined movement. Add the atmosphere when the tone matters. A single gesture or change in light can make the moment easier to understand.",
      "Prepare a product clip with a deliberate camera distance, surface, and light direction. A concrete description keeps the product central. Mention open space when the clip will sit beside a title or product message.",
      "Explore a visual concept by describing the setting, point of view, and pace. Add weather or a time of day to shape the mood. Small cues such as mist, wind, or warm windows can give the scene a readable sense of place.",
    ],
    examples: examples.en,
    trustPoints: ["Free: 1 AI video/day", "5 seconds · 480p", "3 Pro videos for 4.99 USD"],
    extraLinks: [
      { href: ROUTES.en, label: "Free AI image generator" },
      { href: ROUTES.enEdit, label: "AI photo editor" },
    ],
    toolKind: "video",
    isVideo: true,
  },
  enEdit: {
    key: "enEdit",
    locale: "en",
    path: ROUTES.enEdit,
    url: ABSOLUTE_ROUTES.enEdit,
    title: "AI Photo Editor Online, No Sign Up — Edit Photos Free | Ovanto",
    description:
      "Edit a photo with AI online without signing up. Upload an image, describe the change, review the result, and download the finished file.",
    h1: "AI Photo Editor Online — No Sign Up",
    valueLine: "Describe a focused photo change and review the result in your browser.",
    h2s: [
      "Edit a Photo with AI in 3 Steps",
      "Remove Backgrounds and Change the Scene",
      "Improve Light and Retouch a Portrait",
      "AI Photo Editor — FAQ",
    ],
    sectionLeads: [
      "Upload an image, describe the transformation you want, and review the result before downloading it. Say what must stay unchanged, then name the area or atmosphere to adjust. A focused instruction gives the edit a clear starting point and makes it easier to compare the original with the new version. Check edges, lighting, and textures before keeping the file for a presentation, product draft, or personal project.",
      "A cleaner background can make a product or portrait easier to understand. Describe the subject to preserve, the new setting, and the light that should remain believable. For a background change, mention depth, color, and shadow direction. For a style adjustment, describe the intensity and the material that should stay recognizable, so the final image still feels connected to the original.",
      "Name the light, contrast, and natural finish you want before asking for a change. For a portrait, note the expression, facial features, and skin texture that should remain recognizable. For a product image, describe the material, reflections, and direction of the light source. This gives you a clear basis for comparing the source and the result and deciding whether another pass is needed.",
    ],
    sectionDetails: [
      [
        "Start by separating the subject you want to preserve from the area you want to transform. A request such as keep the face and change only the background gives a clearer direction than a general request to change the image.",
        "Then describe the finish you want: soft light, a neutral background, a specific color, or lower contrast. One precise change at a time makes the before and after easier to judge.",
      ],
      [
        "A believable new background depends on the relationship between the subject, the light, and the depth of the scene. Mention shadow direction and color temperature when the result needs to feel natural around a portrait or product.",
        "When the background should disappear, call out delicate edges such as hair, transparent objects, or fine materials. This helps define the edit before you choose the final version.",
      ],
      [
        "For balanced portrait light, say what should remain natural: skin tone, facial volume, eye detail, or clothing texture. Describe the intensity of the change instead of asking for a complete style shift.",
        "Use the three prompt directions below to think through the subject, framing, and light before you describe which elements must stay intact in your own edit.",
      ],
    ],
    faq: [
      {
        question: "How do I edit a photo with AI online?",
        answer:
          "Upload a JPEG, PNG, GIF, or WEBP image up to 10 MB. Describe what to preserve and what to change, compare the result with the original, and download the final version. The allowance is 1 edit per day per IP.",
      },
      {
        question: "Can I remove a background without signing up?",
        answer:
          "Yes. Upload an image up to 10 MB, describe the subject to keep and the new background, then check the edges before downloading.",
      },
      {
        question: "How can I improve the light in a portrait?",
        answer:
          "Upload the portrait, describe the direction and intensity of the light, and name the features and textures to preserve. Compare the original and edited image before downloading.",
      },
    ],
    steps: ["Describe the edit", "Review", "Download"],
    useCases: [
      "Remove a background by naming the subject to preserve and the new setting. Consistent light helps the result feel natural. Mention delicate edges, shadows, and transparent details that need extra care.",
      "Change the atmosphere of a photo with a targeted color, texture, or style. Describe the intensity so the image stays believable. Say what must remain unchanged to keep the subject separate from the mood.",
      "Improve a portrait by describing a natural light direction and finish. Simple instructions can preserve the expression and facial features. Add contrast or skin texture details when they matter to the final result.",
    ],
    examples: examples.en,
    trustPoints: ["Free: 1 edit/day", "No sign up", "Before / After"],
    extraLinks: [
      { href: ROUTES.en, label: "Free AI image generator" },
      { href: ROUTES.enVideo, label: "Free AI video generator" },
    ],
    toolKind: "edit",
    isVideo: false,
  },
  itImage: {
    key: "itImage",
    locale: "it",
    path: ROUTES.itImage,
    url: ABSOLUTE_ROUTES.itImage,
    title: "Generatore di Immagini AI Gratis Senza Registrazione | Ovanto",
    description:
      "Crea immagini con l'intelligenza artificiale gratis e senza registrazione. Scrivi il prompt, genera l'immagine e scarica il risultato online.",
    h1: "Generatore di Immagini AI Gratis Senza Registrazione",
    valueLine: "Trasforma un'idea chiara in un'immagine direttamente dal browser.",
    h2s: [
      "Come Creare un'Immagine AI in 3 Passaggi",
      "Perché Usare un Generatore di Immagini Senza Registrazione",
      "Cosa Puoi Creare con le Immagini AI",
      "Generatore di Immagini AI — Domande Frequenti",
    ],
    sectionLeads: [
      "Scrivi un prompt indicando soggetto, ambiente, luce e atmosfera, poi osserva il risultato prima di scaricarlo. Se la composizione non segue la tua idea, cambia una sola scelta, come l'inquadratura, il colore o lo sfondo. Quando la direzione è convincente, conserva il file per una presentazione, una moodboard o un progetto personale. I tre passaggi restano chiari dalla prima frase all'immagine finale, anche quando stai esplorando uno stile nuovo.",
      "Senza registrazione puoi provare una direzione visiva prima di creare un account. Il piano gratuito comprende 3 immagini al giorno per IP e 1 video AI di 5 secondi in 480p al giorno per IP. Questo percorso è utile per un'idea veloce, un riferimento per il team o un primo concept. Prompt e risultato restano nello stesso flusso del browser, così puoi confrontare le versioni con calma. Una quota giornaliera contenuta invita a descrivere un'idea precisa e a migliorare un dettaglio alla volta.",
      "Indica il soggetto, la composizione, la luce, i colori e lo stile per dare una direzione leggibile al prompt. Un avatar richiede espressione e inquadratura; un prodotto richiede materiale, superficie e fonte luminosa; un paesaggio richiede stagione, meteo e orizzonte. Parti da ciò che deve attirare per primo lo sguardo e aggiungi solo il contesto utile. Una descrizione concreta rende l'immagine più coerente senza usare termini specialistici.",
    ],
    sectionDetails: [
      [
        "Inizia con una frase che unisce soggetto e situazione. Un ritratto vicino a una finestra illuminata offre un punto di partenza più netto di una lista di aggettivi; in seguito puoi precisare colori, distanza e atmosfera.",
        "Osserva prima la posizione del soggetto nell'immagine. Se la composizione non è chiara, modifica l'inquadratura o lo sfondo prima di riscrivere tutto il prompt. Una modifica per tentativo rende il confronto più semplice.",
      ],
      [
        "L'assenza di registrazione è utile anche per confrontare rapidamente una proposta con un collega. Puoi mostrare una direzione, conservare il riferimento e tornare al testo senza creare un profilo per un'idea temporanea.",
        "Il risultato è un punto di partenza per una bozza, una presentazione o una ricerca personale. La scelta resta tua: valuti quale versione rispetta il brief e quale dettaglio merita un nuovo tentativo.",
      ],
      [
        "Per un avatar, metti all'inizio volto, espressione e taglio. Per un prodotto, descrivi il materiale e lo spazio intorno all'oggetto. Per un paesaggio, definisci luogo e atmosfera prima dello stile visivo.",
        "Le tre direzioni qui sotto aiutano a confrontare composizione e luce. Usale come punto di partenza e descrivi nel tuo prompt soggetto, ambiente e colori che desideri.",
      ],
    ],
    faq: [
      {
        question: "Posso creare immagini AI gratis senza registrazione?",
        answer:
          "Sì. Scrivi un prompt senza account e crea fino a 3 immagini al giorno per IP, poi scarica il risultato.",
      },
      {
        question: "Devo creare un account per scaricare l'immagine?",
        answer:
          "No. Descrivi l'immagine, avvia la generazione e scarica il file completato senza creare un account.",
      },
      {
        question: "Quali immagini posso creare?",
        answer:
          "Puoi descrivere un avatar, una scena prodotto, un paesaggio o un'altra idea visiva e scaricare il risultato. Il limite è di 3 generazioni al giorno per IP.",
      },
    ],
    steps: ["Scrivi il prompt", "Genera", "Scarica"],
    useCases: [
      "Crea un avatar descrivendo espressione, inquadratura e stile. Aggiungi la luce se l'atmosfera del ritratto è importante. Un abito o un oggetto semplice può dare al personaggio un dettaglio riconoscibile.",
      "Prepara una scena prodotto indicando materiale, superficie, sfondo e luce. Un punto di vista preciso aiuta a mantenere l'oggetto al centro. Lascia spazio libero se l'immagine dovrà accogliere un titolo.",
      "Esplora un paesaggio con stagione, colori, prospettiva e atmosfera. Indica l'ora del giorno quando cielo e luce guidano la composizione. Nebbia, vento o una linea d'orizzonte bassa possono dare struttura allo spazio.",
    ],
    examples: examples.it,
    trustPoints: ["Gratis: 3 immagini al giorno", "Senza registrazione", "Prompt → Immagine"],
    extraLinks: [
      { href: ROUTES.it, label: "Generatore video AI gratis" },
      { href: ROUTES.itEdit, label: "Modifica foto con AI" },
    ],
    toolKind: "image",
    isVideo: false,
  },
  itEdit: {
    key: "itEdit",
    locale: "it",
    path: ROUTES.itEdit,
    url: ABSOLUTE_ROUTES.itEdit,
    title: "Modifica Foto con AI Online Gratis — Senza Registrazione | Ovanto",
    description:
      "Modifica le tue foto con l'intelligenza artificiale senza registrazione. Carica un'immagine, descrivi il cambiamento, controlla il risultato e scaricalo.",
    h1: "Modifica Foto con AI Online — Senza Registrazione",
    valueLine: "Descrivi il ritocco che vuoi e controlla il risultato direttamente online.",
    h2s: [
      "Modificare una Foto con l'AI in 3 Passaggi",
      "Rimuovere lo Sfondo e Cambiare l'Ambiente",
      "Migliorare la Luce e Ritoccare un Ritratto",
      "Modifica Foto con AI — Domande Frequenti",
    ],
    sectionLeads: [
      "Carica un'immagine, descrivi la trasformazione desiderata e controlla ogni dettaglio prima di scaricare il risultato. Indica ciò che deve restare invariato e poi specifica la zona o l'atmosfera da modificare. Un'istruzione precisa offre un punto di partenza chiaro e rende più facile confrontare l'originale con la nuova versione. Verifica contorni, luce e texture prima di conservare il file per una presentazione, una bozza prodotto o un progetto personale.",
      "Uno sfondo più pulito può rendere più chiaro un prodotto o un ritratto. Descrivi il soggetto da mantenere, il nuovo ambiente e la luce che deve restare credibile. Per cambiare lo sfondo, indica profondità, colori e direzione delle ombre. Per un diverso stile, descrivi l'intensità e i materiali che devono restare riconoscibili, così l'immagine conserva il legame con l'originale.",
      "Indica la luce, il contrasto e il risultato naturale che vuoi ottenere. Per un ritratto, specifica espressione, lineamenti e texture da preservare. Per un'immagine prodotto, descrivi materiale, riflessi e direzione della fonte luminosa. In questo modo puoi confrontare il file originale e il risultato con attenzione e decidere se serve un altro tentativo.",
    ],
    sectionDetails: [
      [
        "Inizia distinguendo il soggetto da preservare dalla zona da trasformare. Una richiesta come conserva il volto e cambia solo lo sfondo è più chiara di una domanda generica di modifica.",
        "Aggiungi poi il risultato visivo desiderato: luce morbida, fondo neutro, colore preciso o contrasto ridotto. Una modifica alla volta rende il confronto con l'originale più semplice.",
      ],
      [
        "Uno sfondo credibile dipende dal rapporto tra soggetto, luce e profondità. Indica la direzione delle ombre e la temperatura dei colori quando il risultato deve apparire naturale attorno a un prodotto o a un volto.",
        "Quando lo sfondo deve sparire, descrivi i contorni più delicati, come capelli, trasparenze o oggetti sottili. Questi dettagli aiutano a definire il risultato prima di scegliere la versione finale.",
      ],
      [
        "Per una luce più equilibrata, indica cosa deve restare naturale: incarnato, volumi del viso, sguardo o texture dei vestiti. Descrivi l'intensità del cambiamento invece di chiedere una trasformazione totale.",
        "Le tre idee di prompt qui sotto aiutano a osservare inquadratura e luce. Usale per decidere quali elementi devono restare intatti nella tua richiesta di ritocco.",
      ],
    ],
    faq: [
      {
        question: "Come posso modificare una foto con l'AI online?",
        answer:
          "Carica un'immagine JPEG, PNG, GIF o WEBP fino a 10 MB. Indica cosa conservare e cosa modificare, confronta il risultato con l'originale e scarica la versione finale. Il limite è di 1 modifica al giorno per IP.",
      },
      {
        question: "Posso rimuovere lo sfondo senza registrazione?",
        answer:
          "Sì. Carica un'immagine fino a 10 MB, descrivi il soggetto da mantenere e il nuovo sfondo, poi controlla i contorni prima di scaricare.",
      },
      {
        question: "Come posso migliorare la luce di un ritratto?",
        answer:
          "Carica il ritratto, descrivi direzione e intensità della luce e indica i lineamenti e le texture da preservare. Confronta prima e dopo prima di scaricare il risultato.",
      },
    ],
    steps: ["Descrivi il ritocco", "Controlla", "Scarica"],
    useCases: [
      "Rimuovi uno sfondo indicando il soggetto da conservare e il nuovo ambiente. Una luce coerente rende il risultato naturale. Specifica contorni delicati, ombre ed elementi trasparenti che richiedono attenzione.",
      "Cambia l'atmosfera di una foto con un colore, una texture o uno stile mirato. Descrivi l'intensità per mantenere un aspetto credibile e indica cosa deve rimanere invariato.",
      "Migliora un ritratto descrivendo una direzione luminosa e un risultato naturale. Istruzioni semplici aiutano a preservare espressione e lineamenti. Aggiungi contrasto o texture della pelle quando sono importanti.",
    ],
    examples: examples.it,
    trustPoints: ["Gratis: 1 modifica al giorno", "Senza registrazione", "Prima / Dopo"],
    extraLinks: [
      { href: ROUTES.itImage, label: "Generatore di immagini AI" },
      { href: ROUTES.it, label: "Generatore video AI" },
    ],
    toolKind: "edit",
    isVideo: false,
  },
  nlVideo: {
    key: "nlVideo",
    locale: "nl",
    path: ROUTES.nlVideo,
    url: ABSOLUTE_ROUTES.nlVideo,
    title: "AI Video Maken Gratis Zonder Registratie | Ovanto",
    description:
      "Maak gratis een korte AI-video zonder registratie. Beschrijf onderwerp en beweging, genereer een clip van 5 seconden en download het resultaat.",
    h1: "AI Video Maken Gratis Zonder Registratie",
    valueLine: "Zet een helder idee om in een korte video, rechtstreeks in je browser.",
    h2s: [
      "In 3 Stappen een AI-video Maken",
      "Waarom een AI-videogenerator Zonder Registratie Gebruiken",
      "Wat Je met AI-video Kunt Maken",
      "AI-video Maken — Veelgestelde Vragen",
    ],
    sectionLeads: [
      "Schrijf een prompt met onderwerp, omgeving, beweging en sfeer. Bekijk de scène wanneer de video klaar is en pas één duidelijk detail aan als het tempo of de camerabeweging niet bij je idee past. Wanneer de reeks helder voelt, download je het bestand voor een presentatie, storyboard, concept of persoonlijk project. De drie stappen blijven overzichtelijk van de eerste zin tot de uiteindelijke clip, zodat iedere poging je helpt om de scène beter te beschrijven.",
      "Zonder registratie kun je eerst een video-idee testen. Het gratis aanbod bevat 1 AI-video van 5 seconden in 480p per dag per IP. Je kunt ook 3 Pro AI-videogeneraties kopen voor 4,99 USD als eenmalige aankoop, zonder abonnement of automatische verlenging. Zo kun je een verhaal, productidee of presentatie uitproberen zonder eerst een profiel voor te bereiden. De browserstroom houdt prompt en resultaat bij elkaar, zodat je rustig kunt kiezen welke richting verder moet.",
      "Beschrijf een onderwerp, een plek en een zichtbare beweging om de scène een duidelijk middelpunt te geven. Een productclip heeft baat bij een oppervlak, camerastandpunt en licht richting. Een verhaalfragment heeft baat bij een gebaar, perspectief en emotie. Voor een conceptscène helpen weer, tijdstip en achtergrond om de actie leesbaar te houden. Begin met de belangrijkste beweging en voeg daarna alleen de context toe die de scène ondersteunt.",
    ],
    sectionDetails: [
      [
        "Begin met één zin waarin onderwerp en actie samenkomen. Een fietser die bij zonsopgang een stille brug oversteekt geeft de beweging een helder doel; daarna kun je kleur, kader en sfeer toevoegen.",
        "Bekijk eerst de algemene beweging voordat je kleine details wijzigt. Voeg bij een statische scène een gebaar of eenvoudige camerabeweging toe. Verwijder bij een druk beeld bijzaken zodat het hoofdonderwerp ruimte krijgt.",
      ],
      [
        "Een browsersessie is handig wanneer je samen met iemand verschillende richtingen vergelijkt. Je kunt een eerste clip tonen, opschrijven wat moet veranderen en terugkeren naar de prompt zonder een profiel te maken voor een eenmalig idee.",
        "Het resultaat is een visueel startpunt voor een pitch, moodboard of verhaalbespreking. Jij bepaalt welke versie bij de opdracht past en of de scène nog een nieuwe poging nodig heeft.",
      ],
      [
        "Beschrijf bij een product hoe de camera langs het materiaal beweegt en wat scherp moet blijven. Beschrijf bij een verhaal het gebaar en het moment dat de kijker moet opmerken. Zet bij conceptkunst eerst de plek en sfeer neer voordat je de stijl toevoegt.",
        "Gebruik de drie richtingen hieronder om tempo, kader en licht te vergelijken. Beschrijf daarna in je eigen prompt het onderwerp, de omgeving en de beweging die je wilt onderzoeken.",
      ],
    ],
    faq: [
      {
        question: "Kan ik gratis een AI-video maken zonder registratie?",
        answer:
          "Ja. Je kunt zonder account 1 AI-video per dag per IP maken. De gratis video duurt 5 seconden en heeft een resolutie van 480p.",
      },
      {
        question: "Heb ik een account nodig om mijn video te downloaden?",
        answer:
          "Nee. Schrijf een prompt, genereer de clip en download het voltooide bestand zonder een account te maken.",
      },
      {
        question: "Wat gebeurt er nadat ik de gratis video heb gebruikt?",
        answer:
          "Elke IP kan 1 gratis AI-video van 5 seconden in 480p per dag maken. Je kunt ook een Ovanto Pro Video Pack kopen voor 4,99 USD met 3 Pro-generaties als eenmalige aankoop, zonder abonnement of automatische verlenging.",
      },
    ],
    steps: ["Schrijf een prompt", "Genereren", "Downloaden"],
    useCases: [
      "Laat een idee zien met een korte scène, een duidelijk onderwerp en één beweging. Voeg de sfeer toe wanneer de toon belangrijk is. Een enkel gebaar of een verandering in licht maakt het moment begrijpelijker.",
      "Maak een productclip met een bewust gekozen camerastandpunt, oppervlak en licht richting. Een concrete beschrijving houdt het product centraal. Benoem lege ruimte als de clip naast een titel of producttekst komt.",
      "Verken een visueel concept door omgeving, perspectief en tempo te beschrijven. Voeg weer of tijdstip toe om de sfeer te sturen. Mist, wind of warme ramen kunnen de plek herkenbaar maken.",
    ],
    examples: examples.nl,
    trustPoints: ["Gratis: 1 AI-video per dag", "5 seconden · 480p", "3 Pro-video's voor 4,99 USD"],
    extraLinks: [
      { href: ROUTES.nl, label: "Gratis AI-afbeelding maken" },
      { href: ROUTES.nlEdit, label: "Foto bewerken met AI" },
    ],
    toolKind: "video",
    isVideo: true,
  },
  nlEdit: {
    key: "nlEdit",
    locale: "nl",
    path: ROUTES.nlEdit,
    url: ABSOLUTE_ROUTES.nlEdit,
    title: "Foto Bewerken met AI Online — Zonder Registratie | Ovanto",
    description:
      "Bewerk een foto online met AI zonder registratie. Upload een afbeelding, beschrijf de wijziging, bekijk het resultaat en download het bestand.",
    h1: "Foto Bewerken met AI Online — Zonder Registratie",
    valueLine: "Beschrijf een gerichte fotowijziging en bekijk het resultaat in je browser.",
    h2s: [
      "Een Foto Bewerken met AI in 3 Stappen",
      "Achtergrond Verwijderen en de Scène Aanpassen",
      "Licht Verbeteren en een Portret Bewerken",
      "Foto Bewerken met AI — Veelgestelde Vragen",
    ],
    sectionLeads: [
      "Upload een afbeelding, beschrijf de gewenste verandering en bekijk het resultaat voordat je het downloadt. Zeg wat hetzelfde moet blijven en noem daarna het gebied of de sfeer die je wilt aanpassen. Een duidelijke instructie geeft de bewerking een helder uitgangspunt en maakt het eenvoudiger om origineel en resultaat te vergelijken. Controleer randen, licht en texturen voordat je het bestand bewaart voor een presentatie, productconcept of persoonlijk project.",
      "Een rustige achtergrond maakt een product of portret vaak beter leesbaar. Beschrijf het onderwerp dat moet blijven, de nieuwe omgeving en het licht dat geloofwaardig moet blijven. Noem bij een nieuwe achtergrond ook diepte, kleuren en de richting van schaduwen. Beschrijf bij een andere stijl de gewenste intensiteit en het materiaal dat herkenbaar moet blijven, zodat het beeld verbonden blijft met het origineel.",
      "Noem de gewenste belichting, het contrast en de natuurlijke uitstraling. Geef bij een portret aan welke uitdrukking, gelaatstrekken en huidtextuur herkenbaar moeten blijven. Geef bij een productfoto materiaal, reflecties en de richting van de lichtbron aan. Zo kun je het oorspronkelijke bestand en de bewerkte versie zorgvuldig vergelijken en beslissen of een nieuwe poging nodig is.",
    ],
    sectionDetails: [
      [
        "Begin met het verschil tussen het onderwerp dat je wilt behouden en het gebied dat je wilt veranderen. Een zin als behoud het gezicht en verander alleen de achtergrond geeft meer richting dan een algemene vraag om de foto te wijzigen.",
        "Beschrijf daarna het gewenste beeld: zacht licht, een neutrale achtergrond, een bepaalde kleur of minder contrast. Eén gerichte wijziging per poging maakt vergelijken eenvoudiger.",
      ],
      [
        "Een geloofwaardige nieuwe achtergrond hangt samen met onderwerp, licht en diepte. Benoem schaduwrichting en kleurtemperatuur wanneer het resultaat natuurlijk moet blijven rond een portret of product.",
        "Noem bij het verwijderen van een achtergrond moeilijke randen, zoals haar, transparante delen of dunne voorwerpen. Zo wordt duidelijk welke details extra aandacht nodig hebben.",
      ],
      [
        "Zeg bij gelijkmatiger portretlicht wat natuurlijk moet blijven: huidskleur, gezichtsvormen, ogen of kledingtextuur. Beschrijf de intensiteit van de wijziging in plaats van om een volledige stijlverandering te vragen.",
        "Gebruik de drie prompt-richtingen hieronder om onderwerp, kader en licht te bepalen voordat je in je eigen bewerking aangeeft wat intact moet blijven.",
      ],
    ],
    faq: [
      {
        question: "Hoe kan ik online een foto bewerken met AI?",
        answer:
          "Upload een JPEG-, PNG-, GIF- of WEBP-afbeelding van maximaal 10 MB. Beschrijf wat moet blijven en wat moet veranderen, vergelijk het resultaat met het origineel en download de eindversie. De limiet is 1 bewerking per dag per IP.",
      },
      {
        question: "Kan ik zonder registratie een achtergrond verwijderen?",
        answer:
          "Ja. Upload een afbeelding van maximaal 10 MB, beschrijf het onderwerp en de nieuwe achtergrond en controleer de randen voordat je downloadt.",
      },
      {
        question: "Hoe kan ik het licht in een portret verbeteren?",
        answer:
          "Upload het portret, beschrijf de richting en intensiteit van het licht en noem de gelaatstrekken en texturen die moeten blijven. Vergelijk origineel en resultaat voordat je downloadt.",
      },
    ],
    steps: ["Beschrijf de bewerking", "Controleren", "Downloaden"],
    useCases: [
      "Verwijder een achtergrond door het onderwerp en de nieuwe omgeving te beschrijven. Gelijkmatig licht houdt het resultaat natuurlijk. Noem moeilijke randen, schaduwen en transparante details.",
      "Verander de sfeer van een foto met een gerichte kleur, textuur of stijl. Beschrijf de intensiteit zodat het beeld geloofwaardig blijft. Benoem wat hetzelfde moet blijven om sfeer en onderwerp uit elkaar te houden.",
      "Verbeter een portret door een natuurlijke lichtrichting en uitstraling te beschrijven. Eenvoudige instructies helpen de uitdrukking en gelaatstrekken te bewaren. Voeg contrast of huidtextuur toe wanneer dat voor het resultaat belangrijk is.",
    ],
    examples: examples.nl,
    trustPoints: ["Gratis: 1 bewerking per dag", "Geen registratie", "Voor / Na"],
    extraLinks: [
      { href: ROUTES.nl, label: "Gratis AI-afbeelding maken" },
      { href: ROUTES.nlVideo, label: "AI-video maken" },
    ],
    toolKind: "edit",
    isVideo: false,
  },
};
