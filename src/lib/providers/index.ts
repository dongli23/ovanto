import { modelFor, type GenerationTask, type GenerationTier } from "../models";
import { pollFal, submitFal } from "./fal";
import {
  isAllowedCdnUrl,
  isAllowedFalStorageUrl,
  pollReplicate,
  submitReplicate,
  type GenerateOptions,
  type ProviderPoll,
  type ProviderSubmission,
  type ProviderName,
  ProviderProtocolError,
  ProviderRejectedError,
  ProviderUnavailableError,
} from "./replicate";

export type { GenerateOptions, ProviderPoll, ProviderSubmission, ProviderName } from "./replicate";
export {
  isAllowedCdnUrl,
  isAllowedFalStorageUrl,
  ProviderProtocolError,
  ProviderRejectedError,
  ProviderUnavailableError,
} from "./replicate";

/** Submit one generation through the provider selected by the model table. */
export async function generate(task: GenerationTask, tier: GenerationTier, options: Omit<GenerateOptions, "task">): Promise<ProviderSubmission> {
  const model = modelFor(task, tier);
  const request = { ...options, task };
  return model.provider === "replicate" ? submitReplicate(model, request) : submitFal(model, request);
}

/** Poll the existing asynchronous provider job without changing its model. */
export async function poll(
  provider: ProviderName,
  requestId: string,
  task: GenerationTask,
  options?: { statusUrl?: string; responseUrl?: string; model?: string },
): Promise<ProviderPoll> {
  return provider === "replicate"
    ? pollReplicate(requestId, task, options?.model)
    : pollFal(requestId, task, options);
}
