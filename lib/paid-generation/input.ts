import { isGenerationKind, MAX_GENERATION_BODY_BYTES, MAX_PROMPT_LENGTH, MAX_VIDEO_PROMPT_LENGTH, type GenerationKind } from "../generation/config";
import { PaymentError } from "../payments/errors";
import { assertExactKeys, readJson } from "../payments/http";

export const PAID_JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface PaidGenerationInput {
  kind: GenerationKind;
  prompt: string;
  idempotencyKey: string;
  assetId?: string;
}

export async function parsePaidGenerationInput(request: Request): Promise<PaidGenerationInput> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new PaymentError("REQUEST_INVALID", 400);
  const body = await readJson(request, MAX_GENERATION_BODY_BYTES);
  if (!isGenerationKind(body.kind)) throw new PaymentError("PRODUCT_INVALID", 400);
  assertExactKeys(body, body.kind === "edit" ? ["kind", "prompt", "idempotencyKey", "assetId"] : ["kind", "prompt", "idempotencyKey"]);
  const limit = body.kind === "video" ? MAX_VIDEO_PROMPT_LENGTH : MAX_PROMPT_LENGTH;
  if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.trim().length > limit) throw new PaymentError("REQUEST_INVALID", 400);
  if (typeof body.idempotencyKey !== "string" || !PAID_JOB_ID.test(body.idempotencyKey)) throw new PaymentError("REQUEST_INVALID", 400);
  if (body.kind === "edit" && (typeof body.assetId !== "string" || !PAID_JOB_ID.test(body.assetId))) throw new PaymentError("REQUEST_INVALID", 400);
  return { kind: body.kind, prompt: body.prompt.trim(), idempotencyKey: body.idempotencyKey, ...(body.kind === "edit" ? { assetId: body.assetId as string } : {}) };
}
