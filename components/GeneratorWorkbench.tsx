"use client";

import { Generator, type PromptExample } from "./Generator";
import type { ToolKind } from "../lib/content";
import { ROUTES, type Locale } from "../lib/site";

export type GeneratorMode = ToolKind;

type ModeCopy = {
  image: string;
  edit: string;
  video: string;
  imageAction: string;
  editAction: string;
  videoAction: string;
};

const modeCopy: Record<Locale, ModeCopy> = {
  en: {
    image: "Image",
    edit: "Edit",
    video: "Video",
    imageAction: "Generate Image",
    editAction: "Generate Edit",
    videoAction: "Generate Video",
  },
  it: {
    image: "Immagine",
    edit: "Modifica",
    video: "Video",
    imageAction: "Genera immagine",
    editAction: "Genera modifica",
    videoAction: "Genera video",
  },
  fr: {
    image: "Image",
    edit: "Modifier",
    video: "Vidéo",
    imageAction: "Générer une image",
    editAction: "Générer la modification",
    videoAction: "Générer une vidéo",
  },
  nl: {
    image: "Afbeelding",
    edit: "Bewerken",
    video: "Video",
    imageAction: "Afbeelding genereren",
    editAction: "Bewerking genereren",
    videoAction: "Video genereren",
  },
};

const examples: Record<Locale, Record<GeneratorMode, readonly PromptExample[]>> = {
  en: {
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
  it: {
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
  fr: {
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
  nl: {
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
};

function routeForMode(locale: Locale, mode: GeneratorMode) {
  if (locale === "fr") {
    if (mode === "image") return ROUTES.frGenerate;
    if (mode === "edit") return ROUTES.frEdit;
    return ROUTES.fr;
  }
  if (locale === "it") return mode === "video" ? ROUTES.it : null;
  if (locale === "nl") return mode === "image" ? ROUTES.nl : null;
  return mode === "image" ? ROUTES.en : null;
}

export function GeneratorWorkbench({
  locale,
  title,
  valueLine,
  mode,
  turnstileSiteKey,
}: {
  locale: Locale;
  title: string;
  valueLine: string;
  mode: GeneratorMode;
  turnstileSiteKey?: string;
}) {
  const localized = modeCopy[locale];
  const labels: Record<GeneratorMode, string> = {
    image: localized.image,
    edit: localized.edit,
    video: localized.video,
  };
  const actionLabels: Record<GeneratorMode, string> = {
    image: localized.imageAction,
    edit: localized.editAction,
    video: localized.videoAction,
  };

  return (
    <div className="workbench-shell" aria-label={title}>
      <nav className="workbench-modes" aria-label="Generator mode">
        {(Object.keys(labels) as GeneratorMode[]).map((nextMode) => {
          const href = routeForMode(locale, nextMode);
          if (!href) return null;
          return (
            <a
              className={`workbench-mode${nextMode === mode ? " is-active" : ""}`}
              href={href}
              key={nextMode}
              aria-current={nextMode === mode ? "page" : undefined}
            >
              {labels[nextMode]}
            </a>
          );
        })}
      </nav>
      <Generator
        locale={locale}
        title={title}
        valueLine={valueLine}
        toolKind={mode}
        turnstileSiteKey={turnstileSiteKey}
        actionLabel={actionLabels[mode]}
        examples={examples[locale][mode]}
        showPaidAccess={false}
      />
    </div>
  );
}

export default GeneratorWorkbench;
