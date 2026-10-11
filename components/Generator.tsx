"use client";

import Script from "next/script";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { PaidAccess, defaultPaidAccessState, type PaidAccessState } from "./PaidAccess";
import { buildFreeGenerationBody, buildPaidGenerationBody } from "../lib/generation/request-body";
import { capPromptDraft, readPromptDraft, writePromptDraft } from "../lib/generation/prompt-draft";
import {
  buildGenerationAttemptSignature,
  clearGenerationWorkspaceAttempt,
  clearGenerationWorkspaceState,
  readExplicitVideoTier,
  readGenerationWorkspaceState,
  type GenerationWorkspaceState,
  writeGenerationWorkspaceState,
} from "../lib/generation/workspace-state";
import type { ToolKind } from "../lib/content";
import type { Locale } from "../lib/site";

type QuotaResponse = {
  remaining: number;
  limit: number;
  available: boolean;
  code?: string;
};

type GenerationResult = {
  url: string;
  mediaType: "image" | "video";
};

type ResultJob = {
  id: string;
  paid: boolean;
};

type GenerationResponse = {
  id: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  remaining?: number;
  result?: GenerationResult;
  code?: string;
};

type GenerationKind = "image" | "video" | "edit";

type UploadedAsset = {
  assetId: string;
  url: string;
};

export type PromptExample = {
  label: string;
  prompt: string;
};

type UploadState = "idle" | "uploading" | "ready" | "error";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      execution: "execute";
      appearance: "interaction-only";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type Copy = {
  generate: string;
  promptLabel: string;
  placeholders: Record<GenerationKind, string>;
  download: string;
  openResult: string;
  retry: string;
  generating: string;
  error: string;
  limitReached: string;
  unavailable: string;
  promptRequired: string;
  checking: string;
  resultReady: string;
  resultFailed: string;
  imageAlt: string;
  editAlt: string;
  videoLabel: string;
  paidLabel: string;
  creditsLabel: string;
  waiting: string;
  downloadError: string;
  uploadHint: string;
  uploadRules: string;
  uploadTypeError: string;
  uploadSizeError: string;
  uploadError: string;
  uploadRequired: string;
  uploadInProgress: string;
  uploadReady: string;
  originalAlt: string;
  paidCreditsRequired: string;
  paidSessionRequired: string;
  paidSubmissionUncertain: string;
  settingsLabel: string;
  modelLabel: string;
  inputLabel: string;
  aspectLabel: string;
  outputLabel: string;
  providerOutput: string;
  durationLabel: string;
  originalLabel: string;
  beforeLabel: string;
  afterLabel: string;
  examplesLabel: string;
  previewDescription: Record<GenerationKind, string>;
  freeQuota: (remaining: number, limit: number) => string;
  unknownQuota: string;
  securityLabel: string;
};

const copy: Record<Locale, Copy> = {
  en: {
    generate: "Generate",
    promptLabel: "Prompt",
    placeholders: {
      image: "Describe the image you want…",
      video: "Describe the video you want…",
      edit: "Describe how you want to edit the image…",
    },
    download: "Download",
    openResult: "Open result",
    retry: "Try again",
    generating: "Generating…",
    error: "Something went wrong. Try again.",
    limitReached: "Daily free limit reached. Try again tomorrow or choose a paid option.",
    unavailable: "Generation is temporarily unavailable. Please try again shortly.",
    promptRequired: "Describe what you want to create first.",
    checking: "Checking availability…",
    resultReady: "Your result is ready.",
    resultFailed: "The generation could not be completed. Try again.",
    imageAlt: "Your generated Ovanto image",
    editAlt: "Your edited Ovanto image",
    videoLabel: "Your generated Ovanto video",
    paidLabel: "Paid",
    creditsLabel: "credits",
    waiting: "Describe an idea to begin.",
    downloadError: "The file could not be downloaded. Please try again.",
    uploadHint: "Upload an image",
    uploadRules: "JPEG, PNG, GIF or WebP · 10 MB max",
    uploadTypeError: "Choose a JPEG, PNG, GIF or WebP image.",
    uploadSizeError: "Images must be 10 MB or smaller.",
    uploadError: "The image could not be uploaded. Try again.",
    uploadRequired: "Upload an image before generating.",
    uploadInProgress: "Uploading…",
    uploadReady: "Image ready.",
    originalAlt: "Original uploaded image",
    paidCreditsRequired: "Select a paid credit balance before generating, or continue to payment below.",
    paidSessionRequired: "Paid access needs to be activated before generating.",
    paidSubmissionUncertain: "Request outcome is being checked; your credit remains reserved.",
    settingsLabel: "Generation settings",
    modelLabel: "Model",
    inputLabel: "Input",
    aspectLabel: "Aspect ratio",
    outputLabel: "Output",
    providerOutput: "Provider output",
    durationLabel: "Duration",
    originalLabel: "Original",
    beforeLabel: "Before",
    afterLabel: "After",
    examplesLabel: "Try an example prompt",
    previewDescription: {
      image: "Your generated image will appear here.",
      video: "Your generated video will appear here.",
      edit: "Your edited image will appear here.",
    },
    freeQuota: (remaining, limit) => `Free (${remaining}/${limit} today)`,
    unknownQuota: "Free (quota unavailable)",
    securityLabel: "Security verification",
  },
  it: {
    generate: "Genera",
    promptLabel: "Prompt",
    placeholders: {
      image: "Descrivi l'immagine che vuoi creare…",
      video: "Descrivi il video che vuoi creare…",
      edit: "Descrivi come vuoi modificare l'immagine…",
    },
    download: "Scarica",
    openResult: "Apri il risultato",
    retry: "Riprova",
    generating: "Generazione…",
    error: "Qualcosa è andato storto. Riprova.",
    limitReached: "Limite giornaliero raggiunto. Riprova domani o scegli un'opzione a pagamento.",
    unavailable: "La generazione non è disponibile al momento. Riprova tra poco.",
    promptRequired: "Descrivi prima ciò che vuoi creare.",
    checking: "Verifica disponibilità…",
    resultReady: "Il risultato è pronto.",
    resultFailed: "La generazione non è riuscita. Riprova.",
    imageAlt: "La tua immagine generata con Ovanto",
    editAlt: "La tua immagine modificata con Ovanto",
    videoLabel: "Il tuo video generato con Ovanto",
    paidLabel: "A pagamento",
    creditsLabel: "crediti",
    waiting: "Descrivi un'idea per iniziare.",
    downloadError: "Non è stato possibile scaricare il file. Riprova.",
    uploadHint: "Carica un'immagine",
    uploadRules: "JPEG, PNG, GIF o WebP · massimo 10 MB",
    uploadTypeError: "Scegli un'immagine JPEG, PNG, GIF o WebP.",
    uploadSizeError: "Le immagini devono avere una dimensione massima di 10 MB.",
    uploadError: "Non è stato possibile caricare l'immagine. Riprova.",
    uploadRequired: "Carica un'immagine prima di generare.",
    uploadInProgress: "Caricamento…",
    uploadReady: "Immagine pronta.",
    originalAlt: "Immagine originale caricata",
    paidCreditsRequired: "Seleziona un saldo di crediti a pagamento prima di generare oppure vai al pagamento qui sotto.",
    paidSessionRequired: "L'accesso a pagamento deve essere attivato prima di generare.",
    paidSubmissionUncertain: "Stiamo verificando l'esito della richiesta; il tuo credito resta riservato.",
    settingsLabel: "Impostazioni di generazione",
    modelLabel: "Modello",
    inputLabel: "Ingresso",
    aspectLabel: "Formato",
    outputLabel: "Qualità",
    providerOutput: "Output del provider",
    durationLabel: "Durata",
    originalLabel: "Originale",
    beforeLabel: "Prima",
    afterLabel: "Dopo",
    examplesLabel: "Prova un prompt di esempio",
    previewDescription: {
      image: "Qui apparirà la tua immagine generata.",
      video: "Qui apparirà il tuo video generato.",
      edit: "Qui apparirà la tua immagine modificata.",
    },
    freeQuota: (remaining, limit) => `Gratis (${remaining}/${limit} oggi)`,
    unknownQuota: "Gratis (quota non disponibile)",
    securityLabel: "Verifica di sicurezza",
  },
  fr: {
    generate: "Générer",
    promptLabel: "Prompt",
    placeholders: {
      image: "Décrivez l'image que vous voulez créer…",
      video: "Décrivez la vidéo que vous voulez créer…",
      edit: "Décrivez comment modifier l'image…",
    },
    download: "Télécharger",
    openResult: "Ouvrir le résultat",
    retry: "Réessayer",
    generating: "Génération…",
    error: "Une erreur est survenue. Réessayez.",
    limitReached: "Limite journalière atteinte. Réessayez demain ou choisissez une option payante.",
    unavailable: "La génération est momentanément indisponible. Réessayez dans un instant.",
    promptRequired: "Décrivez d'abord ce que vous souhaitez créer.",
    checking: "Vérification de la disponibilité…",
    resultReady: "Votre résultat est prêt.",
    resultFailed: "La génération n'a pas abouti. Réessayez.",
    imageAlt: "Votre image générée avec Ovanto",
    editAlt: "Votre image retouchée avec Ovanto",
    videoLabel: "Votre vidéo générée avec Ovanto",
    paidLabel: "Payant",
    creditsLabel: "crédits",
    waiting: "Décrivez une idée pour commencer.",
    downloadError: "Le fichier n'a pas pu être téléchargé. Réessayez.",
    uploadHint: "Téléchargez une image",
    uploadRules: "JPEG, PNG, GIF ou WebP · 10 Mo maximum",
    uploadTypeError: "Choisissez une image JPEG, PNG, GIF ou WebP.",
    uploadSizeError: "Les images doivent faire 10 Mo ou moins.",
    uploadError: "L'image n'a pas pu être téléchargée. Réessayez.",
    uploadRequired: "Téléchargez une image avant de générer.",
    uploadInProgress: "Téléchargement…",
    uploadReady: "Image prête.",
    originalAlt: "Image originale téléchargée",
    paidCreditsRequired: "Sélectionnez un solde de crédits payants avant de générer, ou continuez vers le paiement ci-dessous.",
    paidSessionRequired: "L'accès payant doit être activé avant de générer.",
    paidSubmissionUncertain: "Le résultat de la demande est vérifié ; votre crédit reste réservé.",
    settingsLabel: "Paramètres de génération",
    modelLabel: "Modèle",
    inputLabel: "Entrée",
    aspectLabel: "Format",
    outputLabel: "Qualité",
    providerOutput: "Sortie du fournisseur",
    durationLabel: "Durée",
    originalLabel: "Original",
    beforeLabel: "Avant",
    afterLabel: "Après",
    examplesLabel: "Essayez un prompt exemple",
    previewDescription: {
      image: "Votre image générée apparaîtra ici.",
      video: "Votre vidéo générée apparaîtra ici.",
      edit: "Votre image retouchée apparaîtra ici.",
    },
    freeQuota: (remaining, limit) => `Gratuit (${remaining}/${limit} aujourd'hui)`,
    unknownQuota: "Gratuit (quota indisponible)",
    securityLabel: "Vérification de sécurité",
  },
  nl: {
    generate: "Genereren",
    promptLabel: "Prompt",
    placeholders: {
      image: "Beschrijf de afbeelding die je wilt maken…",
      video: "Beschrijf de video die je wilt maken…",
      edit: "Beschrijf hoe je de afbeelding wilt bewerken…",
    },
    download: "Downloaden",
    openResult: "Resultaat openen",
    retry: "Opnieuw proberen",
    generating: "Genereren…",
    error: "Er ging iets mis. Probeer opnieuw.",
    limitReached: "Daglimiet bereikt. Probeer morgen opnieuw of kies een betaalde optie.",
    unavailable: "Genereren is tijdelijk niet beschikbaar. Probeer het zo opnieuw.",
    promptRequired: "Beschrijf eerst wat je wilt maken.",
    checking: "Beschikbaarheid controleren…",
    resultReady: "Je resultaat staat klaar.",
    resultFailed: "Genereren is niet gelukt. Probeer opnieuw.",
    imageAlt: "Je gegenereerde Ovanto-afbeelding",
    editAlt: "Je bewerkte Ovanto-afbeelding",
    videoLabel: "Je gegenereerde Ovanto-video",
    paidLabel: "Betaald",
    creditsLabel: "credits",
    waiting: "Beschrijf een idee om te beginnen.",
    downloadError: "Het bestand kon niet worden gedownload. Probeer opnieuw.",
    uploadHint: "Upload een afbeelding",
    uploadRules: "JPEG, PNG, GIF of WebP · maximaal 10 MB",
    uploadTypeError: "Kies een JPEG-, PNG-, GIF- of WebP-afbeelding.",
    uploadSizeError: "Afbeeldingen mogen maximaal 10 MB zijn.",
    uploadError: "De afbeelding kon niet worden geüpload. Probeer opnieuw.",
    uploadRequired: "Upload eerst een afbeelding voordat je genereert.",
    uploadInProgress: "Uploaden…",
    uploadReady: "Afbeelding klaar.",
    originalAlt: "Originele geüploade afbeelding",
    paidCreditsRequired: "Kies een saldo met betaalde credits voordat je genereert, of ga hieronder door naar de betaling.",
    paidSessionRequired: "Betaalde toegang moet worden geactiveerd voordat je kunt genereren.",
    paidSubmissionUncertain: "De uitkomst van je aanvraag wordt gecontroleerd; je credit blijft gereserveerd.",
    settingsLabel: "Generatie-instellingen",
    modelLabel: "Model",
    inputLabel: "Invoer",
    aspectLabel: "Beeldverhouding",
    outputLabel: "Uitvoer",
    providerOutput: "Uitvoer van provider",
    durationLabel: "Duur",
    originalLabel: "Origineel",
    beforeLabel: "Voor",
    afterLabel: "Na",
    examplesLabel: "Probeer een voorbeeldprompt",
    previewDescription: {
      image: "Je gegenereerde afbeelding verschijnt hier.",
      video: "Je gegenereerde video verschijnt hier.",
      edit: "Je bewerkte afbeelding verschijnt hier.",
    },
    freeQuota: (remaining, limit) => `Gratis (${remaining}/${limit} vandaag)`,
    unknownQuota: "Gratis (quotum niet beschikbaar)",
    securityLabel: "Beveiligingscontrole",
  },
};

function generationKind(kind: ToolKind): GenerationKind {
  if (kind === "video") return "video";
  if (kind === "edit") return "edit";
  return "image";
}

const MAX_UPLOAD_BYTES = 10_000_000;
const ALLOWED_UPLOAD_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]);

function isAllowedUploadFile(file: File) {
  return ALLOWED_UPLOAD_TYPES.has(file.type.toLowerCase());
}

function isAllowedFalMediaUrl(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.port && (host === "fal.media" || host.endsWith(".fal.media"));
  } catch {
    return false;
  }
}

function isAllowedSignedUploadUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return "00000000-0000-4000-8000-000000000000";
}

function errorCodeMessage(code: string | undefined, localized: Copy) {
  if (code === "DAILY_LIMIT_REACHED" || code === "FREE_LIMIT_REACHED" || code === "RATE_LIMITED") return localized.limitReached;
  if (code === "INSUFFICIENT_CREDITS") return localized.paidCreditsRequired;
  if (code === "SUBMISSION_UNCERTAIN") return localized.paidSubmissionUncertain;
  if (code === "PAID_SESSION_REQUIRED" || code === "ACCOUNT_SESSION_REQUIRED") return localized.paidSessionRequired;
  if (code === "ASSET_REQUIRED") return localized.uploadRequired;
  if (code?.startsWith("ASSET_")) return localized.uploadError;
  if (
    code === "TURNSTILE_REQUIRED" ||
    code === "TURNSTILE_FAILED" ||
    code === "SERVICE_UNAVAILABLE" ||
    code === "FREE_POOL_EXHAUSTED" ||
    code === "REGION_BLOCKED" ||
    code?.includes("CONFIGURATION") ||
    code?.includes("IDENTITY") ||
    code?.includes("COUNTRY") ||
    code?.includes("STORAGE") ||
    code?.includes("PROVIDER") ||
    code?.includes("UNAVAILABLE") ||
    code === "INTERNAL_ERROR"
    || code === "PAYMENT_UNAVAILABLE"
    || code === "PAYMENT_CONFIGURATION_UNAVAILABLE"
  ) return localized.unavailable;
  return localized.error;
}

function uploadCodeMessage(code: string | undefined, localized: Copy) {
  if (code === "ASSET_TOO_LARGE" || code === "REQUEST_TOO_LARGE") return localized.uploadSizeError;
  if (code === "UNSUPPORTED_MEDIA_TYPE" || code === "ASSET_TYPE_UNSUPPORTED") return localized.uploadTypeError;
  if (code === "ASSET_REQUIRED") return localized.uploadRequired;
  if (code === "REGION_BLOCKED" || code?.includes("CONFIGURATION") || code?.includes("STORAGE") || code?.includes("TURNSTILE")) {
    return localized.unavailable;
  }
  return localized.uploadError;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function withApiCode(error: Error, code: string | undefined) {
  if (code) (error as Error & { code?: string }).code = code;
  return error;
}

function fallbackDownloadFilename(mediaType: GenerationResult["mediaType"]) {
  return mediaType === "video" ? "ovanto-video.mp4" : "ovanto-image.webp";
}

function safeDownloadFilename(response: Response, mediaType: GenerationResult["mediaType"]) {
  const contentDisposition = response.headers.get("content-disposition");
  const basicMatch = contentDisposition?.match(/(?:^|;)\s*filename\s*=\s*(?:"([^"]*)"|([^;\s]+))\s*(?:;|$)/i);
  const candidate = basicMatch?.[1] ?? basicMatch?.[2];
  const allowedFilename = mediaType === "video"
    ? /^ovanto-video\.(?:mp4|webm)$/
    : /^ovanto-image\.(?:webp|png|jpg|jpeg|gif|avif)$/;
  if (candidate && allowedFilename.test(candidate)) {
    return candidate;
  }

  const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  const mimeFilenames: Record<string, string> = {
    "image/webp": "ovanto-image.webp",
    "image/png": "ovanto-image.png",
    "image/jpeg": "ovanto-image.jpg",
    "image/gif": "ovanto-image.gif",
    "image/avif": "ovanto-image.avif",
    "video/mp4": "ovanto-video.mp4",
    "video/webm": "ovanto-video.webm",
  };
  return (contentType && mimeFilenames[contentType] && (mediaType === "video" ? contentType.startsWith("video/") : contentType.startsWith("image/")))
    ? mimeFilenames[contentType]
    : fallbackDownloadFilename(mediaType);
}

export function Generator({
  locale,
  title,
  valueLine,
  toolKind,
  turnstileSiteKey,
  examples = [],
  actionLabel,
  showPaidAccess = true,
}: {
  locale: Locale;
  title: string;
  valueLine: string;
  toolKind: ToolKind;
  turnstileSiteKey?: string;
  examples?: readonly PromptExample[];
  actionLabel?: string;
  showPaidAccess?: boolean;
}) {
  const localized = copy[locale];
  const kind = generationKind(toolKind);
  const isEdit = toolKind === "edit";
  const [prompt, setPromptState] = useState("");
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const [quotaError, setQuotaError] = useState(!turnstileSiteKey);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [resultJob, setResultJob] = useState<ResultJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [uploadedAsset, setUploadedAsset] = useState<UploadedAsset | null>(null);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [paidState, setPaidState] = useState<PaidAccessState>(defaultPaidAccessState);
  const [paidRefreshSignal, setPaidRefreshSignal] = useState(0);
  const [paidRemaining, setPaidRemaining] = useState<number | undefined>(undefined);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const pendingJobId = useRef<string | null>(null);
  const attemptIdentity = useRef<string | null>(null);
  const pendingPaid = useRef(false);
  const idempotencyKey = useRef<string | null>(null);
  const uploadAttempt = useRef(0);
  const promptEditedRef = useRef(false);
  const promptRestoreAttemptedRef = useRef(false);
  const workspaceRestoreKindRef = useRef<GenerationKind | null>(null);
  const turnstileResolver = useRef<{
    resolve: (token: string) => void;
    reject: () => void;
  } | null>(null);

  const persistWorkspaceState = useCallback((state: Omit<GenerationWorkspaceState, "version" | "kind">) => {
    writeGenerationWorkspaceState({ version: 1, kind, ...state });
  }, [kind]);

  const setPrompt = useCallback((value: string) => {
    const nextPrompt = capPromptDraft(value);
    promptEditedRef.current = true;
    writePromptDraft(nextPrompt);
    setPromptState(nextPrompt);
  }, []);

  useEffect(() => {
    if (promptRestoreAttemptedRef.current) return;
    promptRestoreAttemptedRef.current = true;
    if (promptEditedRef.current) return;

    const draft = readPromptDraft();
    if (draft) setPromptState(capPromptDraft(draft));
  }, []);

  useEffect(() => {
    if (workspaceRestoreKindRef.current === kind) return;
    workspaceRestoreKindRef.current = kind;

    const saved = readGenerationWorkspaceState(kind);
    if (!saved) return;

    if (saved.uploadedAsset) {
      setUploadedAsset(saved.uploadedAsset);
      setUploadName(saved.uploadName);
      setUploadState("ready");
    }
    if (saved.pendingJob) {
      if (!saved.attemptSignature || !saved.idempotencyKey || saved.paid === null) return;
      attemptIdentity.current = saved.attemptSignature;
      idempotencyKey.current = saved.idempotencyKey;
      pendingPaid.current = saved.paid;
      pendingJobId.current = saved.pendingJob.id;
      return;
    }
    if (saved.result && saved.resultJob) {
      setResult(saved.result);
      setResultJob(saved.resultJob);
      setStatus("success");
    }
  }, [kind]);

  const loadQuota = useCallback(async () => {
    if (!turnstileSiteKey) {
      setQuota(null);
      setQuotaError(true);
      return;
    }
    try {
      const response = await fetch(`/api/quota?kind=${kind}`, { cache: "no-store" });
      const payload = await readJson<QuotaResponse>(response);
      if (!response.ok || !payload || typeof payload.remaining !== "number" || typeof payload.limit !== "number") {
        throw new Error("quota");
      }
      setQuota(payload);
      setQuotaError(false);
    } catch {
      setQuota(null);
      setQuotaError(true);
    }
  }, [kind, turnstileSiteKey]);

  const applyRemaining = useCallback((remaining: number | undefined) => {
    if (typeof remaining !== "number") return;
    setQuota((previous) => previous ? { ...previous, remaining, available: previous.available && remaining > 0 } : previous);
  }, []);

  useEffect(() => {
    void loadQuota();
  }, [loadQuota]);

  const resetTurnstile = useCallback(() => {
    if (widgetId.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetId.current);
      } catch {
        // A removed Turnstile widget can safely be recreated on the next attempt.
        widgetId.current = null;
      }
    }
    turnstileResolver.current = null;
  }, []);

  const waitForTurnstile = useCallback((): Promise<TurnstileApi> => {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const check = () => {
        if (window.turnstile) {
          resolve(window.turnstile);
          return;
        }
        attempts += 1;
        if (attempts > 80) {
          reject(new Error("turnstile"));
          return;
        }
        window.setTimeout(check, 125);
      };
      check();
    });
  }, []);

  const getTurnstileToken = useCallback(async () => {
    if (!turnstileSiteKey || !turnstileContainer.current) throw new Error("turnstile");
    const api = await waitForTurnstile();
    if (!widgetId.current) {
      widgetId.current = api.render(turnstileContainer.current, {
        sitekey: turnstileSiteKey,
        action: "generate",
        execution: "execute",
        appearance: "interaction-only",
        callback: (token) => turnstileResolver.current?.resolve(token),
        "error-callback": () => turnstileResolver.current?.reject(),
        "expired-callback": () => turnstileResolver.current?.reject(),
      });
    } else {
      api.reset(widgetId.current);
    }

    const activeWidgetId = widgetId.current;
    if (!activeWidgetId) throw new Error("turnstile");

    const token = await new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        turnstileResolver.current = null;
        reject(new Error("turnstile"));
      }, 12_000);
      turnstileResolver.current = {
        resolve: (value) => {
          window.clearTimeout(timeout);
          turnstileResolver.current = null;
          resolve(value);
        },
        reject: () => {
          window.clearTimeout(timeout);
          turnstileResolver.current = null;
          reject(new Error("turnstile"));
        },
      };
      api.execute(activeWidgetId);
    });
    return token;
  }, [turnstileSiteKey, waitForTurnstile]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !isEdit) return;

    const requestId = uploadAttempt.current + 1;
    uploadAttempt.current = requestId;
    setUploadName(file.name);
    setUploadedAsset(null);
    setUploadError(null);
    setUploadState("uploading");
    setResult(null);
    setResultJob(null);
    setError(null);
    setDownloadError(null);
    setStatus("idle");
    pendingJobId.current = null;
    attemptIdentity.current = null;
    pendingPaid.current = false;
    idempotencyKey.current = null;
    clearGenerationWorkspaceState(kind);

    if (!isAllowedUploadFile(file)) {
      setUploadState("error");
      setUploadError(localized.uploadTypeError);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadState("error");
      setUploadError(localized.uploadSizeError);
      return;
    }

    try {
      const turnstileToken = await getTurnstileToken();
      if (uploadAttempt.current !== requestId) return;
      const initResponse = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size, turnstileToken }),
      });
      const initPayload = await readJson<{ assetId?: unknown; uploadUrl?: unknown; code?: string; error?: { code?: string } }>(initResponse);
      if (!initResponse.ok || !initPayload) {
        throw withApiCode(new Error("upload"), initPayload?.error?.code || initPayload?.code);
      }
      if (typeof initPayload.assetId !== "string" || !initPayload.assetId || initPayload.assetId.length > 256 || typeof initPayload.uploadUrl !== "string" || !isAllowedSignedUploadUrl(initPayload.uploadUrl)) {
        throw new Error("upload-invalid");
      }
      const putResponse = await fetch(initPayload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putResponse.ok) throw new Error("upload-put");
      let completeResponse = await fetch("/api/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: initPayload.assetId }),
      });
      if (completeResponse.status === 409) {
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        completeResponse = await fetch("/api/uploads/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: initPayload.assetId }),
        });
      }
      const completePayload = await readJson<{ assetId?: unknown; url?: unknown; code?: string; error?: { code?: string } }>(completeResponse);
      if (!completeResponse.ok || !completePayload) {
        throw withApiCode(new Error("upload"), completePayload?.error?.code || completePayload?.code);
      }
      if (completePayload.assetId !== initPayload.assetId || typeof completePayload.url !== "string" || !isAllowedFalMediaUrl(completePayload.url)) {
        throw new Error("upload-invalid");
      }
      if (uploadAttempt.current !== requestId) return;
      setUploadedAsset({ assetId: initPayload.assetId, url: completePayload.url });
      setUploadState("ready");
      setUploadError(null);
      persistWorkspaceState({
        attemptSignature: null,
        idempotencyKey: null,
        paid: null,
        pendingJob: null,
        result: null,
        resultJob: null,
        uploadedAsset: { assetId: initPayload.assetId, url: completePayload.url },
        uploadName: file.name.slice(0, 256),
      });
    } catch (caught) {
      if (uploadAttempt.current !== requestId) return;
      const apiCode = caught instanceof Error ? (caught as Error & { code?: unknown }).code : undefined;
      setUploadState("error");
      setUploadedAsset(null);
      setUploadError(
        caught instanceof Error && caught.message === "upload-invalid"
          ? localized.uploadError
          : caught instanceof Error && caught.message === "turnstile"
            ? localized.unavailable
            : uploadCodeMessage(typeof apiCode === "string" ? apiCode : undefined, localized),
      );
    } finally {
      if (uploadAttempt.current === requestId) resetTurnstile();
    }
  };

  const applyPaidRemaining = useCallback((remaining: number | undefined) => {
    if (typeof remaining !== "number" || remaining < 0) return;
    setPaidRemaining(remaining);
    setPaidState((previous) => ({ ...previous, balance: remaining }));
  }, []);

  const pollGeneration = useCallback(async (id: string, paid: boolean) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      const endpoint = paid ? `/api/paid/generations/${encodeURIComponent(id)}` : `/api/generations/${encodeURIComponent(id)}`;
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await readJson<GenerationResponse & { error?: { code?: string } }>(response);
      if (!response.ok || !payload) {
        throw withApiCode(new Error("generation"), payload?.error?.code || payload?.code);
      }
      if (paid) applyPaidRemaining(payload.remaining);
      else applyRemaining(payload.remaining);
      if (paid && payload.code === "SUBMISSION_UNCERTAIN") return payload;
      if (payload.status === "succeeded" || payload.status === "failed") return payload;
    }
    throw new Error("generation-timeout");
  }, [applyPaidRemaining, applyRemaining]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "loading") return;
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError(localized.promptRequired);
      setStatus("error");
      return;
    }
    if (isEdit && !uploadedAsset) {
      setError(localized.uploadRequired);
      setStatus("error");
      return;
    }
    const paidSelected = paidState.enabled && paidState.tier === "paid";
    const requestedAttemptSignature = buildGenerationAttemptSignature({
      kind,
      paid: paidSelected,
      prompt: trimmedPrompt,
      assetId: uploadedAsset?.assetId,
    });
    const pendingAttemptSignature = pendingPaid.current
      ? buildGenerationAttemptSignature({ kind, paid: true, prompt: trimmedPrompt, assetId: uploadedAsset?.assetId })
      : buildGenerationAttemptSignature({ kind, paid: false, prompt: trimmedPrompt, assetId: uploadedAsset?.assetId });
    const explicitVideoTier = kind === "video" ? readExplicitVideoTier() : null;
    const canResumePendingJob = Boolean(
      pendingJobId.current
      && attemptIdentity.current
      && attemptIdentity.current === pendingAttemptSignature
      && (attemptIdentity.current === requestedAttemptSignature || explicitVideoTier === null),
    );
    const attemptSignature = canResumePendingJob ? attemptIdentity.current! : requestedAttemptSignature;
    const paidAttemptMode = canResumePendingJob ? pendingPaid.current : paidSelected;
    if (paidAttemptMode && !canResumePendingJob && paidState.balance <= 0) {
      setError(localized.paidCreditsRequired);
      setStatus("error");
      return;
    }
    if (!paidAttemptMode) {
      if (quota && !quota.available && !canResumePendingJob) {
        setError(quota.code === "REGION_BLOCKED" || quota.code === "FREE_POOL_EXHAUSTED" ? localized.unavailable : localized.limitReached);
        setStatus("error");
        return;
      }
      if ((quotaError || !turnstileSiteKey) && !canResumePendingJob) {
        setError(localized.unavailable);
        setStatus("error");
        return;
      }
    }

    setStatus("loading");
    setError(null);
    setResult(null);
    setResultJob(null);
    setDownloadError(null);
    try {
      if (attemptIdentity.current !== attemptSignature) {
        clearGenerationWorkspaceAttempt(kind);
        attemptIdentity.current = attemptSignature;
        pendingJobId.current = null;
        pendingPaid.current = paidAttemptMode;
        idempotencyKey.current = newIdempotencyKey();
      }
      if (!idempotencyKey.current) idempotencyKey.current = newIdempotencyKey();

      let payload: GenerationResponse;
      if (pendingJobId.current) {
        payload = await pollGeneration(pendingJobId.current, pendingPaid.current);
      } else {
        const payloadInput = {
          kind,
          prompt: trimmedPrompt,
          idempotencyKey: idempotencyKey.current ?? newIdempotencyKey(),
          ...(isEdit && uploadedAsset ? { assetId: uploadedAsset.assetId } : {}),
        };
        // Paid and free endpoints accept different body shapes; keep them separate.
        const requestBody = paidAttemptMode
          ? buildPaidGenerationBody(payloadInput)
          : buildFreeGenerationBody(payloadInput, await getTurnstileToken());
        const response = await fetch(paidAttemptMode ? "/api/paid/generate" : "/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        const responsePayload = await readJson<GenerationResponse & { error?: { code?: string } }>(response);
        if (!response.ok || !responsePayload) {
          const code = responsePayload?.error?.code || responsePayload?.code;
          setError(code ? errorCodeMessage(code, localized) : localized.unavailable);
          setStatus("error");
          return;
        }
        if (paidAttemptMode) applyPaidRemaining(responsePayload.remaining);
        else applyRemaining(responsePayload.remaining);
        pendingJobId.current = responsePayload.id;
        persistWorkspaceState({
          attemptSignature,
          idempotencyKey: idempotencyKey.current,
          paid: paidAttemptMode,
          pendingJob: { id: responsePayload.id, paid: paidAttemptMode },
          result: null,
          resultJob: null,
          uploadedAsset,
          uploadName,
        });
        payload = responsePayload;
        if (payload.status === "pending" && paidAttemptMode && payload.code === "SUBMISSION_UNCERTAIN") {
          setError(localized.paidSubmissionUncertain);
          setStatus("error");
          return;
        }
        if (payload.status === "pending" || payload.status === "processing") {
          payload = await pollGeneration(payload.id, paidAttemptMode);
        }
      }

      if (paidAttemptMode) applyPaidRemaining(payload.remaining);
      else applyRemaining(payload.remaining);
      const finished = payload;
      if (paidAttemptMode && finished.code === "SUBMISSION_UNCERTAIN") {
        setError(localized.paidSubmissionUncertain);
        setStatus("error");
        return;
      }
      if (finished.status !== "succeeded" || !finished.result) {
        setError(finished.code ? errorCodeMessage(finished.code, localized) : localized.resultFailed);
        setStatus("error");
        clearGenerationWorkspaceAttempt(kind);
        pendingJobId.current = null;
        attemptIdentity.current = null;
        pendingPaid.current = false;
        idempotencyKey.current = null;
        return;
      }
      setResult(finished.result);
      setResultJob({ id: finished.id, paid: paidAttemptMode });
      setStatus("success");
      persistWorkspaceState({
        attemptSignature,
        idempotencyKey: idempotencyKey.current,
        paid: paidAttemptMode,
        pendingJob: null,
        result: finished.result,
        resultJob: { id: finished.id, paid: paidAttemptMode },
        uploadedAsset,
        uploadName,
      });
      pendingJobId.current = null;
      attemptIdentity.current = null;
      pendingPaid.current = false;
      idempotencyKey.current = null;
    } catch (caught) {
      const apiCode = caught instanceof Error ? (caught as Error & { code?: unknown }).code : undefined;
      setError(typeof apiCode === "string" ? errorCodeMessage(apiCode, localized) : localized.unavailable);
      setStatus("error");
    } finally {
      resetTurnstile();
      await loadQuota();
      if (paidAttemptMode) setPaidRefreshSignal((previous) => previous + 1);
    }
  };

  const handleDownload = async () => {
    if (!result || downloadBusy) return;
    setDownloadBusy(true);
    setDownloadError(null);
    try {
      if (!resultJob) throw new Error("download");
      const endpoint = resultJob.paid
        ? `/api/paid/generations/${encodeURIComponent(resultJob.id)}/download`
        : `/api/generations/${encodeURIComponent(resultJob.id)}/download`;
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error("download");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = safeDownloadFilename(response, result.mediaType);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setDownloadError(localized.downloadError);
    } finally {
      setDownloadBusy(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setDownloadError(null);
    setStatus("idle");
    void loadQuota();
  };

  const isPaidVideo = kind === "video" && paidState.enabled && paidState.tier === "paid";
  const modelName = kind === "video" ? (isPaidVideo ? "Kling 2.5 Turbo Pro" : "Wan 2.5") : kind === "edit" ? "Flux Kontext Dev" : "Flux Schnell";
  const outputSetting = kind === "video" ? (isPaidVideo ? localized.providerOutput : "480p") : kind === "edit" ? localized.originalLabel : "1:1";
  const settingItems = kind === "video"
    ? [
        { label: localized.modelLabel, value: modelName },
        { label: localized.durationLabel, value: "5 s" },
        { label: localized.outputLabel, value: outputSetting },
      ]
    : [
        { label: localized.modelLabel, value: modelName },
        { label: kind === "edit" ? localized.inputLabel : localized.aspectLabel, value: outputSetting },
      ];

  const quotaLabel = isPaidVideo
    ? `${localized.paidLabel} (${paidState.balance} ${localized.creditsLabel})`
    : quota
      ? localized.freeQuota(quota.remaining, quota.limit)
      : localized.unknownQuota;
  const generateDisabled = status === "loading" || (isEdit && (uploadState !== "ready" || !uploadedAsset));

  const promptDescription = error ? `${kind}-status ${kind}-error` : `${kind}-status`;
  const resultImageAlt = isEdit ? localized.editAlt : localized.imageAlt;

  const renderMedia = (media: GenerationResult, className = "generated-media") => media.mediaType === "video" ? (
    <video
      className={className}
      src={media.url}
      width={1024}
      height={576}
      controls
      playsInline
      preload="metadata"
      aria-label={localized.videoLabel}
    />
  ) : (
    <Image className={className} src={media.url} width={1024} height={1024} alt={resultImageAlt} unoptimized />
  );

  return (
    <section className={`tool-card workbench${isEdit ? " tool-card-edit" : ""}`} aria-label={title}>
      {turnstileSiteKey ? (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      ) : null}
      <div ref={turnstileContainer} className="turnstile-container" aria-label={localized.securityLabel} />
      <p className="tool-value">{valueLine}</p>
      <div className="workbench-grid">
        <div className="workbench-controls">
          <form className="prompt-form" onSubmit={handleSubmit} aria-busy={status === "loading"}>
            {isEdit ? (
              <div className="edit-input-grid">
                <div className="upload-field">
                  <label className="upload-label" htmlFor="edit-upload">
                    {localized.uploadHint}
                  </label>
                  <input
                    id="edit-upload"
                    className="upload-input"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handleUpload}
                    disabled={uploadState === "uploading" || status === "loading"}
                    aria-invalid={Boolean(uploadError)}
                    aria-describedby={`edit-upload-help${uploadError ? " edit-upload-error" : ""}`}
                  />
                  <p className="upload-rules" id="edit-upload-help">{localized.uploadRules}</p>
                  {uploadName ? <p className="upload-name">{uploadName}</p> : null}
                  {uploadState === "uploading" ? <p className="upload-status">{localized.uploadInProgress}</p> : null}
                  {uploadState === "ready" ? <p className="upload-status">{localized.uploadReady}</p> : null}
                  {uploadError ? <p className="status-error" id="edit-upload-error" role="alert">{uploadError}</p> : null}
                  {uploadedAsset ? (
                    <figure className="upload-original-preview">
                      <figcaption>{localized.originalLabel}</figcaption>
                      <Image
                        src={uploadedAsset.url}
                        width={180}
                        height={180}
                        alt={localized.originalAlt}
                        unoptimized
                      />
                    </figure>
                  ) : null}
                </div>
                <div className="prompt-field">
                  <label className="prompt-label" htmlFor={`${kind}-prompt`}>
                    {localized.promptLabel}
                  </label>
                  <textarea
                    ref={promptRef}
                    id={`${kind}-prompt`}
                    className="prompt-input"
                    placeholder={localized.placeholders[kind]}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    maxLength={2000}
                    disabled={status === "loading"}
                    aria-invalid={Boolean(error)}
                    aria-describedby={promptDescription}
                  />
                </div>
              </div>
            ) : (
              <div className="prompt-field">
                <label className="prompt-label" htmlFor={`${kind}-prompt`}>
                  {localized.promptLabel}
                </label>
                <textarea
                  ref={promptRef}
                  id={`${kind}-prompt`}
                  className="prompt-input"
                  placeholder={localized.placeholders[kind]}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  maxLength={kind === "video" ? 1500 : 2000}
                  disabled={status === "loading"}
                  aria-invalid={Boolean(error)}
                  aria-describedby={promptDescription}
                />
              </div>
            )}
            <fieldset className="workbench-settings" aria-label={localized.settingsLabel}>
              <legend>{localized.settingsLabel}</legend>
              {settingItems.map((setting) => (
                <div className="workbench-setting" key={setting.label}>
                  <span>{setting.label}</span>
                  <strong>{setting.value}</strong>
                </div>
              ))}
            </fieldset>
            <div className="generate-row">
              <button type="submit" className="generate-button" disabled={generateDisabled}>
                {status === "loading" ? localized.generating : actionLabel ?? localized.generate}
              </button>
              <span className="quota-label" aria-live="polite">{quotaLabel}</span>
              {quotaError ? (
                <button type="button" className="retry-button" onClick={handleRetry} disabled={status === "loading"}>
                  {localized.retry}
                </button>
              ) : null}
            </div>
          </form>
        </div>
        <div className="workbench-preview">
          <div className="result-panel" id={`${kind}-status`} aria-live="polite">
            {status === "loading" ? <p className="status-loading">{localized.generating}</p> : null}
            {error ? <p className="status-error" id={`${kind}-error`} role="alert">{error}</p> : null}
            {status === "idle" && !error && !uploadedAsset ? (
              <div className="workbench-empty">
                <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect x="5" y="5" width="30" height="30" rx="7" stroke="currentColor" strokeWidth="1.5"/><circle cx="15" cy="15" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="m7 29 9-9 6 6 5-5 7 8" stroke="currentColor" strokeWidth="1.5"/></svg>
                <strong>{localized.waiting}</strong>
                <p>{localized.previewDescription[kind]}</p>
              </div>
            ) : null}
            {isEdit && uploadedAsset && status === "success" && result ? (
              <div className="result-compare">
                <figure className="result-side original-preview">
                  <figcaption>{localized.beforeLabel}</figcaption>
                  <Image className="original-media" src={uploadedAsset.url} width={1024} height={1024} alt={localized.originalAlt} unoptimized />
                </figure>
                <figure className="result-side generated-preview">
                  <figcaption>{localized.afterLabel}</figcaption>
                  {renderMedia(result)}
                </figure>
              </div>
            ) : isEdit && uploadedAsset && !error && status !== "loading" ? (
              <p>{localized.uploadReady}</p>
            ) : status === "success" && result ? (
              <>
                <p>{localized.resultReady}</p>
                {renderMedia(result)}
              </>
            ) : null}
            {status === "success" && result ? (
              <>
                <button type="button" className="download-button" onClick={handleDownload} disabled={downloadBusy}>
                  {downloadBusy ? localized.generating : localized.download}
                </button>
                {downloadError ? (
                  <>
                    <p className="status-error" role="alert">{downloadError}</p>
                    <a className="result-fallback-link" href={result.url} target="_blank" rel="noreferrer">
                      {localized.openResult}
                    </a>
                  </>
                ) : null}
              </>
            ) : null}
            {error ? (
              <button type="button" className="retry-button" onClick={handleRetry} disabled={status === "loading"}>
                {localized.retry}
              </button>
            ) : null}
            {status === "error" && !error ? <p role="alert">{localized.error}</p> : null}
          </div>
        </div>
      </div>
      {examples.length ? (
        <section className="workbench-examples" aria-labelledby={`${kind}-examples-title`}>
          <p className="workbench-examples-title" id={`${kind}-examples-title`}>
            <strong>{localized.examplesLabel}</strong>
          </p>
          <div className="prompt-examples">
            {examples.map((example) => (
              <button
                type="button"
                className="prompt-example"
                key={`${example.label}-${example.prompt}`}
                onClick={() => {
                  if (status !== "loading") {
                    setError(null);
                    setDownloadError(null);
                    setStatus("idle");
                  }
                  setPrompt(example.prompt);
                  window.requestAnimationFrame(() => promptRef.current?.focus({ preventScroll: true }));
                }}
                disabled={status === "loading"}
              >
                <span>{example.label}</span>
                <small>{example.prompt}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {showPaidAccess ? (
        <PaidAccess
          locale={locale}
          kind={kind}
          busy={status === "loading"}
          refreshSignal={paidRefreshSignal}
          remainingFromGeneration={paidRemaining}
          onStateChange={setPaidState}
        />
      ) : null}
    </section>
  );
}
