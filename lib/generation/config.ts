export type GenerationKind = "image" | "edit" | "video";
export type GenerationStatus = "pending" | "processing" | "succeeded" | "failed";
export type MediaType = "image" | "video";
export type GenerationTier = "free" | "paid";

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
  image: 3_000,
  edit: 23_000,
  video: 250_000,
};
export const FREE_DAILY_BUDGET_MICRO_USD: Record<GenerationKind, number> = {
  image: 3_000_000,
  edit: 2_000_000,
  video: 5_000_000,
};
export const FREE_OVERALL_DAILY_BUDGET_MICRO_USD = 10_000_000;

export const PROVIDER_MODELS = {
  freeImage: {
    provider: "replicate",
    model: "black-forest-labs/flux-schnell",
    submitUrl: "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
    mediaType: "image" as const,
  },
  freeEdit: {
    provider: "replicate",
    model: "black-forest-labs/flux-kontext-dev",
    modelInfoUrl: "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-dev",
    submitUrl: "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-dev/predictions",
    mediaType: "image" as const,
  },
  freeVideo: {
    provider: "fal",
    model: "fal-ai/wan-25-preview/text-to-video",
    submitUrl: "https://queue.fal.run/fal-ai/wan-25-preview/text-to-video",
    mediaType: "video" as const,
  },
} as const;

export const PAID_PROVIDER_MODELS = {
  image: {
    provider: "replicate" as const,
    model: "black-forest-labs/flux-dev",
    submitUrl: "https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions",
    mediaType: "image" as const,
  },
  edit: {
    provider: "fal" as const,
    model: "fal-ai/flux-pro/kontext",
    submitUrl: "https://queue.fal.run/fal-ai/flux-pro/kontext",
    mediaType: "image" as const,
  },
  video: {
    provider: "fal" as const,
    model: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    submitUrl: "https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    mediaType: "video" as const,
  },
} as const;

/**
 * Paid mappings are intentionally configuration metadata only. No paid route
 * is exposed until entitlement and payment verification are implemented.
 */
export const PAID_MODELS = {
  image: { provider: "replicate", model: "black-forest-labs/flux-dev", costMicroUsd: 25_000 },
  edit: { provider: "fal", model: "fal-ai/flux-pro/kontext", costMicroUsd: 40_000 },
  video: { provider: "fal", model: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video", costMicroUsd: 350_000 },
} as const;

/** Free outputs are currently unwatermarked; keep this as a server config switch. */
export const WATERMARK_ENABLED = false;

export const ENV_KEYS = {
  replicate: "REPLICATE_API_KEY",
  fal: "FAL_API_KEY",
  turnstileSecret: "TURNSTILE_SECRET_KEY",
  turnstileSiteKey: "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  turnstileHostname: "TURNSTILE_HOSTNAME",
  redisUrl: "UPSTASH_REDIS_REST_URL",
  redisToken: "UPSTASH_REDIS_REST_TOKEN",
  ipHashSecret: "IP_HASH_SECRET",
} as const;

export const COOKIE_NAME = "ovanto_anon";
export const JOB_TTL_SECONDS = 24 * 60 * 60;
export const DAILY_TTL_SECONDS = 2 * 24 * 60 * 60;
export const AUDIT_TTL_SECONDS = 30 * 24 * 60 * 60;
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

export function providerFor(kind: GenerationKind, tier: GenerationTier = "free") {
  if (tier === "paid") return PAID_PROVIDER_MODELS[kind];
  if (kind === "image") return PROVIDER_MODELS.freeImage;
  if (kind === "edit") return PROVIDER_MODELS.freeEdit;
  return PROVIDER_MODELS.freeVideo;
}

export function providerEnvKey(kind: GenerationKind, tier: GenerationTier = "free"): string {
  return providerFor(kind, tier).provider === "fal" ? ENV_KEYS.fal : ENV_KEYS.replicate;
}
