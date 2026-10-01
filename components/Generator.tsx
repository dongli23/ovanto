"use client";

import Script from "next/script";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { PaidAccess, defaultPaidAccessState, type PaidAccessState } from "./PaidAccess";
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
  placeholder: string;
  download: string;
  generating: string;
  error: string;
  limitReached: string;
  unavailable: string;
  promptRequired: string;
  checking: string;
  resultReady: string;
  resultFailed: string;
  imageAlt: string;
  videoLabel: string;
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
};

const copy: Record<Locale, Copy> = {
  en: {
    generate: "Generate",
    placeholder: "Describe the image you want…",
    download: "Download",
    generating: "Generating…",
    error: "Something went wrong. Try again.",
    limitReached: "Daily free limit reached. Try again tomorrow or choose a paid option.",
    unavailable: "Generation is temporarily unavailable. Please try again shortly.",
    promptRequired: "Describe what you want to create first.",
    checking: "Checking availability…",
    resultReady: "Your result is ready.",
    resultFailed: "The generation could not be completed. Try again.",
    imageAlt: "Your generated Ovanto image",
    videoLabel: "Your generated Ovanto video",
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
  },
  it: {
    generate: "Genera",
    placeholder: "Descrivi il video che vuoi…",
    download: "Scarica",
    generating: "Generazione…",
    error: "Qualcosa è andato storto. Riprova.",
    limitReached: "Limite giornaliero raggiunto. Riprova domani o scegli un'opzione a pagamento.",
    unavailable: "La generazione non è disponibile al momento. Riprova tra poco.",
    promptRequired: "Descrivi prima ciò che vuoi creare.",
    checking: "Verifica disponibilità…",
    resultReady: "Il risultato è pronto.",
    resultFailed: "La generazione non è riuscita. Riprova.",
    imageAlt: "La tua immagine generata con Ovanto",
    videoLabel: "Il tuo video generato con Ovanto",
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
  },
  fr: {
    generate: "Générer",
    placeholder: "Décrivez ce que vous voulez…",
    download: "Télécharger",
    generating: "Génération…",
    error: "Une erreur est survenue. Réessayez.",
    limitReached: "Limite journalière atteinte. Réessayez demain ou choisissez une option payante.",
    unavailable: "La génération est momentanément indisponible. Réessayez dans un instant.",
    promptRequired: "Décrivez d'abord ce que vous souhaitez créer.",
    checking: "Vérification de la disponibilité…",
    resultReady: "Votre résultat est prêt.",
    resultFailed: "La génération n'a pas abouti. Réessayez.",
    imageAlt: "Votre image générée avec Ovanto",
    videoLabel: "Votre vidéo générée avec Ovanto",
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
  },
  nl: {
    generate: "Genereren",
    placeholder: "Beschrijf wat je wilt maken…",
    download: "Downloaden",
    generating: "Genereren…",
    error: "Er ging iets mis. Probeer opnieuw.",
    limitReached: "Daglimiet bereikt. Probeer morgen opnieuw of kies een betaalde optie.",
    unavailable: "Genereren is tijdelijk niet beschikbaar. Probeer het zo opnieuw.",
    promptRequired: "Beschrijf eerst wat je wilt maken.",
    checking: "Beschikbaarheid controleren…",
    resultReady: "Je resultaat staat klaar.",
    resultFailed: "Genereren is niet gelukt. Probeer opnieuw.",
    imageAlt: "Je gegenereerde Ovanto-afbeelding",
    videoLabel: "Je gegenereerde Ovanto-video",
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

export function Generator({
  locale,
  title,
  valueLine,
  toolKind,
  turnstileSiteKey,
}: {
  locale: Locale;
  title: string;
  valueLine: string;
  toolKind: ToolKind;
  turnstileSiteKey?: string;
}) {
  const localized = copy[locale];
  const kind = generationKind(toolKind);
  const isEdit = toolKind === "edit";
  const [prompt, setPrompt] = useState("");
  const [quota, setQuota] = useState<QuotaResponse | null>(null);
  const [quotaError, setQuotaError] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<GenerationResult | null>(null);
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
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const pendingJobId = useRef<string | null>(null);
  const attemptIdentity = useRef<string | null>(null);
  const pendingPaid = useRef(false);
  const idempotencyKey = useRef<string | null>(null);
  const uploadAttempt = useRef(0);
  const turnstileResolver = useRef<{
    resolve: (token: string) => void;
    reject: () => void;
  } | null>(null);

  const loadQuota = useCallback(async () => {
    if (!turnstileSiteKey) {
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
    setError(null);
    setDownloadError(null);
    setStatus("idle");
    pendingJobId.current = null;
    attemptIdentity.current = null;
    pendingPaid.current = false;
    idempotencyKey.current = null;

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
    const attemptSignature = `${paidSelected ? "paid" : "free"}:${kind}:${trimmedPrompt}:${uploadedAsset?.assetId ?? ""}`;
    const canResumePendingJob = Boolean(pendingJobId.current && attemptIdentity.current === attemptSignature);
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
    setDownloadError(null);
    try {
      if (attemptIdentity.current !== attemptSignature) {
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
        const requestBody: Record<string, string> = {
          kind,
          prompt: trimmedPrompt,
          idempotencyKey: idempotencyKey.current ?? newIdempotencyKey(),
        };
        if (isEdit && uploadedAsset) requestBody.assetId = uploadedAsset.assetId;
        if (!paidAttemptMode) requestBody.turnstileToken = await getTurnstileToken();
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
        pendingJobId.current = null;
        attemptIdentity.current = null;
        pendingPaid.current = false;
        idempotencyKey.current = null;
        return;
      }
      setResult(finished.result);
      setStatus("success");
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
      const response = await fetch(result.url);
      if (!response.ok) throw new Error("download");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = result.mediaType === "video" ? "ovanto-video.mp4" : "ovanto-image.webp";
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

  const quotaLabel = quota
    ? quota.available
      ? `${locale === "en" ? "Free" : locale === "it" ? "Gratis" : locale === "fr" ? "Gratuit" : "Gratis"} (${quota.remaining}/${quota.limit} ${locale === "en" ? "today" : locale === "it" ? "oggi" : locale === "fr" ? "aujourd'hui" : "vandaag"})`
      : quota.code === "REGION_BLOCKED" || quota.code === "FREE_POOL_EXHAUSTED"
        ? localized.unavailable
        : localized.limitReached
    : quotaError
      ? localized.unavailable
      : localized.checking;
  const generateDisabled = status === "loading" || (isEdit && (uploadState !== "ready" || !uploadedAsset));

  return (
    <section className={`tool-card${isEdit ? " tool-card-edit" : ""}`} aria-label={title}>
      {turnstileSiteKey ? (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      ) : null}
      <div ref={turnstileContainer} className="turnstile-container" aria-label="Security verification" />
      <p className="tool-value">{valueLine}</p>
      <form className="prompt-form" onSubmit={handleSubmit}>
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
              />
              <p className="upload-rules">{localized.uploadRules}</p>
              {uploadName ? <p className="upload-name">{uploadName}</p> : null}
              {uploadState === "uploading" ? <p className="upload-status">{localized.uploadInProgress}</p> : null}
              {uploadState === "ready" ? <p className="upload-status">{localized.uploadReady}</p> : null}
              {uploadError ? <p className="status-error" role="alert">{uploadError}</p> : null}
            </div>
            <div className="prompt-field">
              <label className="sr-only" htmlFor={`${kind}-prompt`}>
                {localized.placeholder}
              </label>
              <textarea
                id={`${kind}-prompt`}
                className="prompt-input"
                placeholder={localized.placeholder}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                maxLength={2000}
                aria-describedby={`${kind}-status`}
              />
            </div>
          </div>
        ) : (
          <>
            <label className="sr-only" htmlFor={`${kind}-prompt`}>
              {localized.placeholder}
            </label>
            <textarea
              id={`${kind}-prompt`}
              className="prompt-input"
              placeholder={localized.placeholder}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={kind === "video" ? 1500 : 2000}
              aria-describedby={`${kind}-status`}
            />
          </>
        )}
        <div className="generate-row">
          <button type="submit" className="generate-button" disabled={generateDisabled}>
            {status === "loading" ? localized.generating : localized.generate}
          </button>
          <span className="quota-label" aria-live="polite">{quotaLabel}</span>
        </div>
      </form>
      <div className="result-panel" id={`${kind}-status`} aria-live="polite">
        {isEdit && uploadedAsset ? (
          <div className="original-preview">
            <p>{localized.uploadReady}</p>
            <Image className="original-media" src={uploadedAsset.url} width={1024} height={1024} alt={localized.originalAlt} unoptimized />
          </div>
        ) : null}
        {status === "loading" ? <p className="status-loading">{localized.generating}</p> : null}
        {error ? <p className="status-error" role="alert">{error}</p> : null}
        {status === "idle" && !error && !uploadedAsset ? <p>{localized.waiting}</p> : null}
        {status === "success" && result ? (
          <>
            <p>{localized.resultReady}</p>
            {result.mediaType === "video" ? (
              <video className="generated-media" src={result.url} width={1024} height={576} controls playsInline aria-label={localized.videoLabel} />
            ) : (
              <Image className="generated-media" src={result.url} width={1024} height={1024} alt={localized.imageAlt} unoptimized />
            )}
            <button type="button" className="download-button" onClick={handleDownload} disabled={downloadBusy}>
              {localized.download}
            </button>
            {downloadError ? <p className="status-error" role="alert">{downloadError}</p> : null}
          </>
        ) : null}
        {status === "error" && !error ? <p role="alert">{localized.error}</p> : null}
      </div>
      <PaidAccess
        locale={locale}
        kind={kind}
        busy={status === "loading"}
        refreshSignal={paidRefreshSignal}
        remainingFromGeneration={paidRemaining}
        onStateChange={setPaidState}
      />
    </section>
  );
}
