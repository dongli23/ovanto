import type { GenerationKind } from "./request-body";

/**
 * Generation workspace state is deliberately scoped to sessionStorage. It lets
 * a locale route remount continue an already accepted job without replaying a
 * POST, while keeping account, quota, and challenge data out of browser state.
 */
export const GENERATION_WORKSPACE_STATE_VERSION = 1 as const;
export const GENERATION_WORKSPACE_STORAGE_PREFIX = "ovanto:generation-workspace:";
export const EXPLICIT_VIDEO_TIER_STORAGE_KEY = "ovanto:paid-tier:video";

export type GenerationWorkspaceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type ExplicitVideoTier = "free" | "paid";

export type GenerationWorkspaceJob = {
  id: string;
  paid: boolean;
};

export type GenerationWorkspaceResult = {
  url: string;
  mediaType: "image" | "video";
};

export type GenerationWorkspaceAsset = {
  assetId: string;
  url: string;
};

export type GenerationWorkspaceState = {
  version: typeof GENERATION_WORKSPACE_STATE_VERSION;
  kind: GenerationKind;
  /** Null is used for an edit upload draft that has no accepted attempt yet. */
  attemptSignature: string | null;
  idempotencyKey: string | null;
  paid: boolean | null;
  pendingJob: GenerationWorkspaceJob | null;
  result: GenerationWorkspaceResult | null;
  resultJob: GenerationWorkspaceJob | null;
  uploadedAsset: GenerationWorkspaceAsset | null;
  uploadName: string | null;
};

const MAX_IDENTIFIER_LENGTH = 256;
const MAX_SIGNATURE_LENGTH = 8_000;
const MAX_UPLOAD_NAME_LENGTH = 256;

export function generationWorkspaceStorageKey(kind: GenerationKind): string {
  return `${GENERATION_WORKSPACE_STORAGE_PREFIX}${kind}`;
}

function resolveStorage(storage: GenerationWorkspaceStorage | null | undefined): GenerationWorkspaceStorage | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isKind(value: unknown): value is GenerationKind {
  return value === "image" || value === "video" || value === "edit";
}

function isBoundedIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH && /^[A-Za-z0-9._:-]+$/.test(value);
}

function isBoundedSignature(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_SIGNATURE_LENGTH;
}

function isOptionalBoundedSignature(value: unknown): value is string | null {
  return value === null || isBoundedSignature(value);
}

function isOptionalIdentifier(value: unknown): value is string | null {
  return value === null || isBoundedIdentifier(value);
}

function isSafeHttpsUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || parsed.pathname.length <= 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function exactlyOneQueryValue(params: URLSearchParams, name: string): string | undefined {
  const values = params.getAll(name);
  return values.length === 1 && values[0] !== "" ? values[0] : undefined;
}

function isAllowedReplicateR2Url(parsed: URL): boolean {
  const labels = parsed.hostname.toLowerCase().split(".");
  if (labels.length !== 5) return false;
  const [bucket, account, providerLabel, storageLabel, tld] = labels;
  if (providerLabel !== "r2" || storageLabel !== "cloudflarestorage" || tld !== "com") return false;
  if (account.length !== 32 || !/^[a-f0-9]{32}$/.test(account)) return false;
  if (bucket.length < 3 || bucket.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(bucket)) return false;

  const algorithm = exactlyOneQueryValue(parsed.searchParams, "X-Amz-Algorithm");
  const signedHeaders = exactlyOneQueryValue(parsed.searchParams, "X-Amz-SignedHeaders");
  const signature = exactlyOneQueryValue(parsed.searchParams, "X-Amz-Signature");
  const amzDate = exactlyOneQueryValue(parsed.searchParams, "X-Amz-Date");
  const expires = exactlyOneQueryValue(parsed.searchParams, "X-Amz-Expires");
  const credential = exactlyOneQueryValue(parsed.searchParams, "X-Amz-Credential");
  if (algorithm !== "AWS4-HMAC-SHA256" || signedHeaders !== "host") return false;
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  if (!amzDate || !/^\d{8}T\d{6}Z$/.test(amzDate)) return false;
  if (!expires || !/^\d+$/.test(expires)) return false;
  const expiresSeconds = Number(expires);
  if (!Number.isSafeInteger(expiresSeconds) || expiresSeconds < 1 || expiresSeconds > 604800) return false;
  const credentialParts = credential?.match(/^([A-Za-z0-9]+)\/(\d{8})\/auto\/s3\/aws4_request$/);
  return Boolean(credentialParts && credentialParts[2] === amzDate.slice(0, 8));
}

/** Mirrors the current provider output allowlist used by server downloads. */
export function isAllowedGenerationResultUrl(value: string): boolean {
  const parsed = isSafeHttpsUrl(value);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  if (host === "fal.media" || host.endsWith(".fal.media") || host === "fal.ai" || host.endsWith(".fal.ai")) return true;
  if (host === "replicate.delivery" || host.endsWith(".replicate.delivery")) return true;
  if (host === "storage.googleapis.com") return true;
  return isAllowedReplicateR2Url(parsed);
}

/** Mirrors the current Fal upload/result storage allowlist. */
export function isAllowedGenerationAssetUrl(value: string): boolean {
  const parsed = isSafeHttpsUrl(value);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === "fal.media" || host.endsWith(".fal.media") || host === "storage.googleapis.com";
}

function parseJob(value: unknown): GenerationWorkspaceJob | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !isBoundedIdentifier(value.id) || typeof value.paid !== "boolean") return undefined;
  return { id: value.id, paid: value.paid };
}

function parseResult(value: unknown, kind: GenerationKind): GenerationWorkspaceResult | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || typeof value.url !== "string" || !isAllowedGenerationResultUrl(value.url)) return undefined;
  if (value.mediaType !== "image" && value.mediaType !== "video") return undefined;
  if ((kind === "video") !== (value.mediaType === "video")) return undefined;
  return { url: value.url, mediaType: value.mediaType };
}

function parseAsset(value: unknown): GenerationWorkspaceAsset | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !isBoundedIdentifier(value.assetId) || typeof value.url !== "string" || !isAllowedGenerationAssetUrl(value.url)) return undefined;
  return { assetId: value.assetId, url: value.url };
}

/** Parses only the versioned, allowlisted fields used by the workspace. */
export function parseGenerationWorkspaceState(raw: string | null, expectedKind?: GenerationKind): GenerationWorkspaceState | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 32_000) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.version !== GENERATION_WORKSPACE_STATE_VERSION || !isKind(value.kind) || (expectedKind && value.kind !== expectedKind)) return null;
  if (!isOptionalBoundedSignature(value.attemptSignature) || !isOptionalIdentifier(value.idempotencyKey)) return null;
  if (value.paid !== null && typeof value.paid !== "boolean") return null;

  const pendingJob = parseJob(value.pendingJob);
  const result = parseResult(value.result, value.kind);
  const resultJob = parseJob(value.resultJob);
  const uploadedAsset = parseAsset(value.uploadedAsset);
  if (pendingJob === undefined || result === undefined || resultJob === undefined || uploadedAsset === undefined) return null;

  const uploadName = value.uploadName === null ? null : typeof value.uploadName === "string" && value.uploadName.length <= MAX_UPLOAD_NAME_LENGTH ? value.uploadName : undefined;
  if (uploadName === undefined) return null;

  // Accepted attempts always carry all identity fields; an input-only edit
  // draft may carry just an uploaded asset and deliberately has no attempt.
  const hasAttempt = value.attemptSignature !== null || value.idempotencyKey !== null || value.paid !== null || pendingJob !== null || result !== null || resultJob !== null;
  if (hasAttempt && (!isBoundedSignature(value.attemptSignature) || !isBoundedIdentifier(value.idempotencyKey) || typeof value.paid !== "boolean")) return null;
  if (hasAttempt) {
    const attemptSignature = value.attemptSignature as string;
    const paid = value.paid as boolean;
    if (!attemptSignature.startsWith(`${paid ? "paid" : "free"}:${value.kind}:`)) return null;
  }
  if (pendingJob && pendingJob.paid !== value.paid) return null;
  if (resultJob && resultJob.paid !== value.paid) return null;
  if (result && !resultJob) return null;
  if (resultJob && !result) return null;
  if (pendingJob && result) return null;
  if (uploadedAsset && value.kind !== "edit") return null;
  if (uploadName !== null && !uploadedAsset) return null;
  if (!uploadedAsset && !hasAttempt) return null;

  return {
    version: GENERATION_WORKSPACE_STATE_VERSION,
    kind: value.kind,
    attemptSignature: value.attemptSignature,
    idempotencyKey: value.idempotencyKey,
    paid: value.paid,
    pendingJob,
    result,
    resultJob,
    uploadedAsset,
    uploadName,
  };
}

function validState(state: GenerationWorkspaceState): boolean {
  if (state.version !== GENERATION_WORKSPACE_STATE_VERSION || !isKind(state.kind)) return false;
  if (parseGenerationWorkspaceState(JSON.stringify(state), state.kind) === null) return false;
  return true;
}

export function readGenerationWorkspaceState(kind: GenerationKind, storage?: GenerationWorkspaceStorage | null): GenerationWorkspaceState | null {
  const target = resolveStorage(storage);
  if (!target) return null;

  try {
    const raw = target.getItem(generationWorkspaceStorageKey(kind));
    const state = parseGenerationWorkspaceState(raw, kind);
    if (raw !== null && !state) {
      try {
        target.removeItem(generationWorkspaceStorageKey(kind));
      } catch {
        // Invalid state remains unavailable even when cleanup is blocked.
      }
    }
    return state;
  } catch {
    return null;
  }
}

export function writeGenerationWorkspaceState(state: GenerationWorkspaceState, storage?: GenerationWorkspaceStorage | null): void {
  const target = resolveStorage(storage);
  if (!target || !validState(state)) return;

  try {
    target.setItem(generationWorkspaceStorageKey(state.kind), JSON.stringify(state));
  } catch {
    // Browser storage can be disabled or full; generation remains usable.
  }
}

export function clearGenerationWorkspaceState(kind: GenerationKind, storage?: GenerationWorkspaceStorage | null): void {
  const target = resolveStorage(storage);
  if (!target) return;

  try {
    target.removeItem(generationWorkspaceStorageKey(kind));
  } catch {
    // Clearing browser state must never interrupt generation.
  }
}

/** Clears an accepted attempt while retaining a validated edit upload draft. */
export function clearGenerationWorkspaceAttempt(kind: GenerationKind, storage?: GenerationWorkspaceStorage | null): void {
  const target = resolveStorage(storage);
  if (!target) return;

  const current = readGenerationWorkspaceState(kind, target);
  if (!current?.uploadedAsset) {
    clearGenerationWorkspaceState(kind, target);
    return;
  }
  writeGenerationWorkspaceState({
    version: GENERATION_WORKSPACE_STATE_VERSION,
    kind,
    attemptSignature: null,
    idempotencyKey: null,
    paid: null,
    pendingJob: null,
    result: null,
    resultJob: null,
    uploadedAsset: current.uploadedAsset,
    uploadName: current.uploadName,
  }, target);
}

export function buildGenerationAttemptSignature(input: {
  kind: GenerationKind;
  paid: boolean;
  prompt: string;
  assetId?: string;
}): string {
  return `${input.paid ? "paid" : "free"}:${input.kind}:${input.prompt}:${input.assetId ?? ""}`;
}

export function readExplicitVideoTier(storage?: GenerationWorkspaceStorage | null): ExplicitVideoTier | null {
  const target = resolveStorage(storage);
  if (!target) return null;

  try {
    const value = target.getItem(EXPLICIT_VIDEO_TIER_STORAGE_KEY);
    return value === "free" || value === "paid" ? value : null;
  } catch {
    return null;
  }
}

export function writeExplicitVideoTier(tier: ExplicitVideoTier, storage?: GenerationWorkspaceStorage | null): void {
  const target = resolveStorage(storage);
  if (!target || (tier !== "free" && tier !== "paid")) return;

  try {
    target.setItem(EXPLICIT_VIDEO_TIER_STORAGE_KEY, tier);
  } catch {
    // Storage can be unavailable; the in-memory selection remains authoritative.
  }
}
