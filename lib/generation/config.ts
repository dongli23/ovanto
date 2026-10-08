import {
  modelFor,
  type GenerationTask,
  type GenerationTier,
  type ModelDefinition,
} from "../../src/lib/models";

export type GenerationKind = GenerationTask;
export type { GenerationTier } from "../../src/lib/models";
export type GenerationStatus = "pending" | "processing" | "succeeded" | "failed";
export type MediaType = "image" | "video";

/**
 * Free quota and budget values are integer micro-USD. The daily key is always
 * derived from UTC (YYYY-MM-DD), so every region shares the same reset point.
 */
export const DAILY_KEY_TIMEZONE = "UTC" as const;
export const FREE_LIMITS: Record<GenerationKind, number> = {
  image: 3,
  edit: 1,
  video: 1,
};
export const FREE_COST_MICRO_USD: Record<GenerationKind, number> = {
  image: Math.round(modelFor("image", "free").cost * 1_000_000),
  edit: Math.round(modelFor("edit", "free").cost * 1_000_000),
  video: Math.round(modelFor("video", "free").cost * (modelFor("video", "free").fixedSeconds ?? 1) * 1_000_000),
};
export const FREE_DAILY_BUDGET_MICRO_USD: Record<GenerationKind, number> = {
  image: 3_000_000,
  edit: 2_000_000,
  video: 5_000_000,
};
export const FREE_OVERALL_DAILY_BUDGET_MICRO_USD = 10_000_000;

export interface LegacyProviderModel {
  provider: "replicate" | "fal";
  model: string;
  submitUrl: string;
  mediaType: MediaType;
  fixedSeconds?: number;
  resolution?: string;
}

function submitUrl(model: ModelDefinition): string {
  return model.provider === "replicate"
    ? `https://api.replicate.com/v1/models/${model.slug}/predictions`
    : `https://queue.fal.run/${model.slug}`;
}

function legacyModel(kind: GenerationKind, tier: GenerationTier): LegacyProviderModel {
  const model = modelFor(kind, tier);
  return {
    provider: model.provider,
    model: model.slug,
    submitUrl: submitUrl(model),
    mediaType: model.unit === "second" ? "video" : "image",
    ...(model.fixedSeconds === undefined ? {} : { fixedSeconds: model.fixedSeconds }),
    ...(model.resolution === undefined ? {} : { resolution: model.resolution }),
  };
}

/** Compatibility-shaped views for the existing quota, job, and payment code. */
export const PROVIDER_MODELS = {
  freeImage: legacyModel("image", "free"),
  freeEdit: legacyModel("edit", "free"),
  freeVideo: legacyModel("video", "free"),
} as const;

export const PAID_PROVIDER_MODELS = {
  image: legacyModel("image", "paid"),
  edit: legacyModel("edit", "paid"),
  video: legacyModel("video", "paid"),
} as const;

/**
 * Paid mappings are intentionally configuration metadata only. No paid route
 * is exposed until entitlement and payment verification are implemented.
 */
export const PAID_MODELS = {
  image: { provider: PAID_PROVIDER_MODELS.image.provider, model: PAID_PROVIDER_MODELS.image.model, costMicroUsd: Math.round(modelFor("image", "paid").cost * 1_000_000) },
  edit: { provider: PAID_PROVIDER_MODELS.edit.provider, model: PAID_PROVIDER_MODELS.edit.model, costMicroUsd: Math.round(modelFor("edit", "paid").cost * 1_000_000) },
  video: { provider: PAID_PROVIDER_MODELS.video.provider, model: PAID_PROVIDER_MODELS.video.model, costMicroUsd: Math.round(modelFor("video", "paid").cost * (modelFor("video", "paid").fixedSeconds ?? 1) * 1_000_000) },
} as const;

/** Free outputs are currently unwatermarked; keep this as a server config switch. */
export const WATERMARK_ENABLED = false;

export const ENV_KEYS = {
  replicate: "REPLICATE_API_TOKEN",
  fal: "FAL_KEY",
  turnstileSecret: "TURNSTILE_SECRET_KEY",
  turnstileSiteKey: "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  redisUrl: "UPSTASH_REDIS_REST_URL",
  redisToken: "UPSTASH_REDIS_REST_TOKEN",
  ipHashSecret: "IP_HASH_SECRET",
} as const;

export const COOKIE_NAME = "ovanto_anon";
export const JOB_TTL_SECONDS = 24 * 60 * 60;
export const DAILY_TTL_SECONDS = 2 * 24 * 60 * 60;
export const AUDIT_TTL_SECONDS = 30 * 24 * 60 * 60;
export const FREE_GENERATION_STALE_TIMEOUT_MS = 60 * 60 * 1000;
export const MAX_GENERATION_BODY_BYTES = 16 * 1024;
export const MAX_PROMPT_LENGTH = 2_000;
export const MAX_VIDEO_PROMPT_LENGTH = 1_500;
export const MAX_TURNSTILE_TOKEN_LENGTH = 4_096;
export const PROVIDER_REQUEST_TIMEOUT_MS = 12_000;
export const TURNSTILE_REQUEST_TIMEOUT_MS = 8_000;
export const REDIS_REQUEST_TIMEOUT_MS = 8_000;
export const MAX_UPLOAD_BYTES = 10_000_000;
export const MAX_UPLOAD_REQUEST_BYTES = 11 * 1024 * 1024;
export const UPLOAD_WINDOW_SECONDS = 10 * 60;
export const UPLOAD_MAX_COUNT = 5;
export const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
export const ASSET_TTL_SECONDS = 60 * 60;

export function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function isGenerationKind(value: unknown): value is GenerationKind {
  return value === "image" || value === "edit" || value === "video";
}

export function providerFor(kind: GenerationKind, tier: GenerationTier = "free"): LegacyProviderModel {
  return legacyModel(kind, tier);
}

export function providerEnvKey(kind: GenerationKind, tier: GenerationTier = "free"): string {
  return modelFor(kind, tier).provider === "fal" ? ENV_KEYS.fal : ENV_KEYS.replicate;
}

export function fixedVideoOptions(tier: GenerationTier): { duration: string; resolution?: string } {
  const model = modelFor("video", tier);
  return {
    duration: String(model.fixedSeconds),
    ...(model.resolution === undefined ? {} : { resolution: model.resolution }),
  };
}
