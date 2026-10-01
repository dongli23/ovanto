import { GenerationError } from "./errors";
import {
  isGenerationKind,
  MAX_GENERATION_BODY_BYTES,
  MAX_PROMPT_LENGTH,
  MAX_VIDEO_PROMPT_LENGTH,
  MAX_TURNSTILE_TOKEN_LENGTH,
  type GenerationKind,
} from "./config";

export interface GenerateInput {
  kind: GenerationKind;
  prompt: string;
  turnstileToken: string;
  idempotencyKey: string;
  assetId?: string;
}

const BASE_BODY_KEYS = ["idempotencyKey", "kind", "prompt", "turnstileToken"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function parseGenerateInput(request: Request): Promise<GenerateInput> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number.isFinite(Number(contentLength)) && Number(contentLength) > MAX_GENERATION_BODY_BYTES) {
    throw new GenerationError("REQUEST_TOO_LARGE", 413, "Request is too large.");
  }

  const contentType = request.headers.get("content-type");
  if (contentType && !contentType.toLowerCase().split(";", 1)[0].trim().startsWith("application/json")) {
    throw new GenerationError("UNSUPPORTED_MEDIA_TYPE", 415, "Request must be JSON.");
  }

  let raw: string;
  try {
    if (request.body) {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        total += part.value.byteLength;
        if (total > MAX_GENERATION_BODY_BYTES) {
          await reader.cancel();
          throw new GenerationError("REQUEST_TOO_LARGE", 413, "Request is too large.");
        }
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      raw = new TextDecoder().decode(bytes);
    } else {
      raw = "";
    }
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("INVALID_JSON", 400, "Request body is invalid.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GenerationError("INVALID_JSON", 400, "Request body is invalid.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new GenerationError("INVALID_REQUEST", 400, "Request body is invalid.");
  }

  const body = parsed as Record<string, unknown>;
  const { kind, prompt, turnstileToken, idempotencyKey, assetId } = body;
  if (!isGenerationKind(kind)) throw new GenerationError("INVALID_KIND", 400, "Generation kind is invalid.");
  const expectedKeys = kind === "edit" ? [...BASE_BODY_KEYS, "assetId"] : BASE_BODY_KEYS;
  const actualKeys = Object.keys(body).sort();
  const sortedExpected = expectedKeys.slice().sort();
  if (actualKeys.length !== sortedExpected.length || actualKeys.some((key, index) => key !== sortedExpected[index])) {
    throw new GenerationError("INVALID_REQUEST", 400, kind === "edit" ? "Only kind, prompt, turnstileToken, idempotencyKey, and assetId are accepted." : "Only kind, prompt, turnstileToken, and idempotencyKey are accepted.");
  }
  if (typeof prompt !== "string") throw new GenerationError("INVALID_PROMPT", 400, "Prompt is invalid.");
  const normalizedPrompt = prompt.trim();
  const promptLimit = kind === "video" ? MAX_VIDEO_PROMPT_LENGTH : MAX_PROMPT_LENGTH;
  if (!normalizedPrompt || normalizedPrompt.length > promptLimit) {
    throw new GenerationError("INVALID_PROMPT", 400, "Prompt is invalid.");
  }
  if (typeof turnstileToken !== "string" || !turnstileToken || turnstileToken.length > MAX_TURNSTILE_TOKEN_LENGTH) {
    throw new GenerationError("TURNSTILE_REQUIRED", 400, "Human verification is required.");
  }
  if (typeof idempotencyKey !== "string" || !UUID_RE.test(idempotencyKey)) {
    throw new GenerationError("INVALID_IDEMPOTENCY_KEY", 400, "Idempotency key must be a UUID.");
  }
  if (kind === "edit" && (typeof assetId !== "string" || !UUID_RE.test(assetId))) {
    throw new GenerationError("INVALID_ASSET", 400, "An uploaded image is required.");
  }

  return { kind, prompt: normalizedPrompt, turnstileToken, idempotencyKey: idempotencyKey.toLowerCase(), ...(typeof assetId === "string" ? { assetId: assetId.toLowerCase() } : {}) };
}

export function parseQuotaKind(value: string | null): GenerationKind {
  if (!isGenerationKind(value)) throw new GenerationError("INVALID_KIND", 400, "Generation kind is invalid.");
  return value;
}

