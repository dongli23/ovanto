export type GenerationKind = "image" | "video" | "edit";

export interface GenerationPayloadInput {
  kind: GenerationKind;
  prompt: string;
  idempotencyKey: string;
  assetId?: string;
}

/**
 * Request body for POST /api/paid/generate. parsePaidGenerationInput()
 * requires exactly { kind, prompt, idempotencyKey } (plus assetId for edit);
 * anything else (task/tier/turnstileToken) fails closed with PRODUCT_INVALID.
 */
export function buildPaidGenerationBody(input: GenerationPayloadInput): Record<string, string> {
  const body: Record<string, string> = {
    kind: input.kind,
    prompt: input.prompt,
    idempotencyKey: input.idempotencyKey,
  };
  if (input.kind === "edit" && input.assetId) body.assetId = input.assetId;
  return body;
}

/**
 * Request body for POST /api/generate (free tier). This shape is unchanged:
 * { task, tier: "free", prompt, idempotencyKey, turnstileToken } (+ assetId for edit).
 */
export function buildFreeGenerationBody(input: GenerationPayloadInput, turnstileToken: string): Record<string, string> {
  const body: Record<string, string> = {
    task: input.kind,
    tier: "free",
    prompt: input.prompt,
    idempotencyKey: input.idempotencyKey,
  };
  if (input.kind === "edit" && input.assetId) body.assetId = input.assetId;
  body.turnstileToken = turnstileToken;
  return body;
}
