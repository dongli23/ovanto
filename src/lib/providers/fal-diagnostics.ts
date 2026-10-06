import { MODELS } from "../models";

export const FAL_DIAGNOSTIC_CATEGORIES = [
  "authentication",
  "billing",
  "not_found",
  "invalid_request",
  "rate_limit",
  "upstream",
  "network",
  "timeout",
  "protocol",
] as const;

export type FalDiagnosticCategory = (typeof FAL_DIAGNOSTIC_CATEGORIES)[number];
export type FalDiagnosticStage = "submit" | "status" | "result";

export type FalDiagnosticEvent = {
  provider: "fal";
  stage: FalDiagnosticStage;
  model: string;
  http_status: number | null;
  category: FalDiagnosticCategory;
};

export type FalDiagnosticLogger = (event: FalDiagnosticEvent) => void | Promise<void>;

const FAL_MODEL_SLUGS: Set<string> = new Set(
  Object.values(MODELS)
    .filter((model) => model.provider === "fal")
    .map((model) => model.slug),
);

/**
 * Emits only a fixed-shape, allow-listed FAL failure event. Provider response
 * bodies, URLs, credentials, prompts, and exception text never enter this log.
 */
export async function logFalFailure(
  stage: FalDiagnosticStage,
  model: string,
  httpStatus: number | null,
  category: FalDiagnosticCategory,
  logger: FalDiagnosticLogger = defaultLogger,
): Promise<void> {
  const event: FalDiagnosticEvent = {
    provider: "fal",
    stage: normalizeStage(stage),
    model: FAL_MODEL_SLUGS.has(model) ? model : "unknown",
    http_status: normalizeHttpStatus(httpStatus),
    category: normalizeCategory(category),
  };
  try {
    await logger(event);
  } catch {
    // Diagnostics must never alter the provider result or request lifecycle.
  }
}

export function falHttpFailureCategory(status: number): FalDiagnosticCategory {
  if (status === 401 || status === 403) return "authentication";
  if (status === 402) return "billing";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limit";
  if (status >= 400 && status < 500) return "invalid_request";
  return "upstream";
}

function normalizeHttpStatus(value: number | null): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function normalizeStage(value: FalDiagnosticStage): FalDiagnosticStage {
  return (value === "submit" || value === "status" || value === "result") ? value : "result";
}

function normalizeCategory(value: FalDiagnosticCategory): FalDiagnosticCategory {
  return (FAL_DIAGNOSTIC_CATEGORIES as readonly string[]).includes(value) ? value : "protocol";
}

function defaultLogger(event: FalDiagnosticEvent): void {
  console.error(JSON.stringify(event));
}
