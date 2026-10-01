import {
  generate,
  isAllowedCdnUrl,
  isAllowedFalStorageUrl,
  poll,
  ProviderProtocolError,
  ProviderRejectedError,
  ProviderUnavailableError,
  type ProviderName,
  type ProviderPoll,
  type ProviderSubmission,
} from "../../src/lib/providers";
import type { GenerationKind } from "./config";

export {
  isAllowedCdnUrl,
  isAllowedFalStorageUrl,
  ProviderProtocolError,
  ProviderRejectedError,
  ProviderUnavailableError,
};
export type { ProviderName, ProviderPoll, ProviderSubmission };

export async function submitGeneration(kind: GenerationKind, prompt: string, sourceImageUrl?: string): Promise<ProviderSubmission> {
  return generate(kind, "free", { prompt, ...(sourceImageUrl ? { sourceImageUrl } : {}) });
}

/** Payment code may call this only after it has independently reserved credit. */
export async function submitPaidGeneration(kind: GenerationKind, prompt: string, sourceImageUrl?: string): Promise<ProviderSubmission> {
  return generate(kind, "paid", { prompt, ...(sourceImageUrl ? { sourceImageUrl } : {}) });
}

export async function pollGeneration(provider: ProviderName, requestId: string, kind: GenerationKind, options?: { statusUrl?: string; responseUrl?: string; model?: string }): Promise<ProviderPoll> {
  return poll(provider, requestId, kind, options);
}
