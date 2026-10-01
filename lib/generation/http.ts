import { NextResponse } from "next/server";
import { GenerationError, errorResponse } from "./errors";
import type { JobRecord } from "./store";
import { FREE_COST_MICRO_USD, FREE_LIMITS, providerEnvKey, type GenerationKind } from "./config";

export function noStoreJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function publicJob(job: JobRecord, remaining: number): {
  id: string;
  status: JobRecord["status"];
  remaining: number;
  result?: { url: string; mediaType: "image" | "video" };
} {
  const body: {
    id: string;
    status: JobRecord["status"];
    remaining: number;
    result?: { url: string; mediaType: "image" | "video" };
  } = { id: job.id, status: job.status, remaining };
  if (job.status === "succeeded" && job.result) body.result = job.result;
  return body;
}

export function handleApiError(error: unknown): NextResponse {
  return errorResponse(error);
}

export function assertQuotaConfig(kind?: GenerationKind): void {
  const missing: string[] = [];
  if (!process.env.IP_HASH_SECRET) missing.push("IP_HASH_SECRET");
  if (!process.env.UPSTASH_REDIS_REST_URL) missing.push("UPSTASH_REDIS_REST_URL");
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) missing.push("UPSTASH_REDIS_REST_TOKEN");
  if (kind && !process.env[providerEnvKey(kind)]) missing.push(providerEnvKey(kind));
  if (missing.length) throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
}

export function assertGenerationConfig(kind: GenerationKind): void {
  assertQuotaConfig(kind);
  const missing: string[] = [];
  if (!process.env.TURNSTILE_SECRET_KEY) missing.push("TURNSTILE_SECRET_KEY");
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) missing.push("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  if (missing.length) throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
}

export function assertUploadConfig(): void {
  const missing: string[] = [];
  if (!process.env.IP_HASH_SECRET) missing.push("IP_HASH_SECRET");
  if (!process.env.UPSTASH_REDIS_REST_URL) missing.push("UPSTASH_REDIS_REST_URL");
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) missing.push("UPSTASH_REDIS_REST_TOKEN");
  if (!process.env.FAL_KEY) missing.push("FAL_KEY");
  if (!process.env.TURNSTILE_SECRET_KEY) missing.push("TURNSTILE_SECRET_KEY");
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) missing.push("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  if (missing.length) throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
}

export function quotaResponseMessage(kind: GenerationKind): { limit: number; costMicroUsd: number } {
  return { limit: FREE_LIMITS[kind], costMicroUsd: FREE_COST_MICRO_USD[kind] };
}

