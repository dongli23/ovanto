const MAX_DIAGNOSTIC_BYTES = 16 * 1024;
const MAX_SUMMARY_LENGTH = 500;

const SAFE_ERROR_CODES = new Set([
  "authentication_error",
  "invalid_api_key",
  "invalid_token",
  "unauthorized",
  "forbidden",
  "insufficient_credit",
  "insufficient_credits",
  "insufficient_quota",
  "billing_error",
  "payment_required",
  "model_access_denied",
  "model_not_found",
  "invalid_model",
  "not_found",
  "validation_error",
  "invalid_input",
  "invalid_field",
  "malformed_request",
  "rate_limit",
  "rate_limit_exceeded",
  "rate_limited",
  "too_many_requests",
]);

const SAFE_INPUT_FIELDS = ["prompt", "input_image", "num_outputs", "output_format"] as const;

type SafeInputField = (typeof SAFE_INPUT_FIELDS)[number];
type SafeScalar = string | number | boolean | null;
type DiagnosticCode = string | number | null;

export type ReplicateDiagnosticEvent = {
  provider: "replicate";
  model: string;
  http_status: number;
  provider_error_type: DiagnosticCode;
  provider_error_code: DiagnosticCode;
  provider_error_summary: string;
};

export type ReplicateDiagnosticLogger = (event: ReplicateDiagnosticEvent) => void;

type BodyRead =
  | { kind: "json"; value: unknown }
  | { kind: "non_json" }
  | { kind: "oversized" }
  | { kind: "read_failure" };

type SafeErrorFields = {
  text: string[];
  codes: SafeScalar[];
  types: SafeScalar[];
  fields: string[];
};

/**
 * Emits a bounded, allow-listed diagnostic for one non-2xx Replicate response.
 * This function deliberately absorbs both body-read and logger failures so the
 * caller can keep the provider error classification it already selected.
 */
export async function logReplicateFailure(
  response: Response,
  model: string,
  logger: ReplicateDiagnosticLogger = defaultLogger,
): Promise<void> {
  let event: ReplicateDiagnosticEvent;
  try {
    event = await buildDiagnosticEvent(response, model);
  } catch {
    event = fallbackEvent(response, model, "read_failure", "Provider error response could not be read; details omitted");
  }
  try {
    logger(event);
  } catch {
    // Diagnostics must never affect the provider result or request lifecycle.
  }
}

async function buildDiagnosticEvent(response: Response, model: string): Promise<ReplicateDiagnosticEvent> {
  const body = await readDiagnosticBody(response);
  if (body.kind === "non_json") {
    return fallbackEvent(response, model, "response", "Provider returned a non-JSON error response; details omitted");
  }
  if (body.kind === "oversized") {
    return fallbackEvent(response, model, "response", "Provider error response exceeded diagnostic limit; details omitted");
  }
  if (body.kind === "read_failure") {
    return fallbackEvent(response, model, "read_failure", "Provider error response could not be read; details omitted");
  }

  const fields = collectSafeErrorFields(body.value);
  const classification = classifyError(response.status, fields);
  return {
    provider: "replicate",
    model,
    http_status: response.status,
    provider_error_type: safeErrorCode(fields.types),
    provider_error_code: safeErrorCode(fields.codes),
    provider_error_summary: limitSummary(classification.summary),
  };
}

function fallbackEvent(
  response: Response,
  model: string,
  type: string,
  summary: string,
): ReplicateDiagnosticEvent {
  return {
    provider: "replicate",
    model,
    http_status: response.status,
    provider_error_type: null,
    provider_error_code: null,
    provider_error_summary: limitSummary(summary),
  };
}

function defaultLogger(event: ReplicateDiagnosticEvent): void {
  console.error(JSON.stringify(event));
}

async function readDiagnosticBody(response: Response): Promise<BodyRead> {
  if (!response.body) return { kind: "read_failure" };

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = response.body.getReader();
  } catch {
    return { kind: "read_failure" };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      const chunk = part.value;
      total += chunk.byteLength;
      if (total > MAX_DIAGNOSTIC_BYTES) {
        try { await reader.cancel(); } catch { /* the upstream body is already closed */ }
        return { kind: "oversized" };
      }
      chunks.push(chunk);
    }
  } catch {
    try { await reader.cancel(); } catch { /* the upstream body is already closed */ }
    return { kind: "read_failure" };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { kind: "non_json" };
  }
  return { kind: "json", value };
}

function collectSafeErrorFields(value: unknown): SafeErrorFields {
  const fields: SafeErrorFields = { text: [], codes: [], types: [], fields: [] };
  if (!isRecord(value)) return fields;

  for (const key of ["detail", "title", "type", "status", "code"] as const) {
    const candidate = value[key];
    if (!isScalar(candidate)) continue;
    if (key === "code") fields.codes.push(candidate);
    if (key === "type") fields.types.push(candidate);
    if (typeof candidate === "string") fields.text.push(candidate);
  }

  const error = value.error;
  if (isScalar(error)) {
    if (typeof error === "string") fields.text.push(error);
    else fields.codes.push(error);
  } else if (isRecord(error)) {
    for (const key of ["message", "detail", "title", "type", "status", "code", "field", "param", "parameter"] as const) {
      const candidate = error[key];
      if (!isScalar(candidate)) continue;
      if (key === "code") fields.codes.push(candidate);
      if (key === "type") fields.types.push(candidate);
      if (typeof candidate === "string") {
        fields.text.push(candidate);
        if (key === "field" || key === "param" || key === "parameter") fields.fields.push(candidate);
      }
    }
  }

  return fields;
}

function classifyError(status: number, fields: SafeErrorFields): { type: string; summary: string } {
  const evidence = fields.text.join(" ").toLowerCase();
  const field = findInvalidInputField(evidence, fields.fields);
  if (field) return { type: "validation", summary: `Provider rejected input field: ${field}.` };

  if (status === 429 || hasAny(evidence, ["rate limit", "rate_limit", "too many requests", "throttl"])) {
    return { type: "rate_limit", summary: "Provider rate limit reached." };
  }
  if (status === 401 || hasAny(evidence, ["authentication", "unauthorized", "invalid api key", "invalid token"])) {
    return { type: "authentication", summary: "Provider authentication failed." };
  }
  if (status === 402 || hasAny(evidence, ["insufficient credit", "insufficient balance", "insufficient_quota", "billing", "payment required"])) {
    return { type: "billing", summary: "Provider account has insufficient credit." };
  }
  if (hasAny(evidence, ["model access", "model_access", "access denied", "permission denied"])) {
    return { type: "model_access", summary: "Provider model access was rejected." };
  }
  if (status === 404 || hasAny(evidence, ["model not found", "invalid model", "not found", "does not exist"])) {
    return { type: "not_found", summary: "Provider resource was not found." };
  }
  if (status === 400 || status === 422 || hasAny(evidence, ["validation", "malformed", "bad request", "invalid input", "missing field", "required field"])) {
    return { type: "validation", summary: "Provider rejected the request fields." };
  }
  return { type: "unknown", summary: "Unrecognized provider error; details omitted" };
}

function findInvalidInputField(evidence: string, explicitFields: string[]): SafeInputField | undefined {
  const invalidEvidence = hasAny(evidence, ["invalid", "missing", "required", "unsupported", "malformed", "unknown field", "must be"]);
  for (const candidate of explicitFields) {
    const safeField = normalizeInputField(candidate);
    if (safeField && invalidEvidence) return safeField;
  }
  if (!invalidEvidence) return undefined;
  for (const safeField of SAFE_INPUT_FIELDS) {
    if (new RegExp(`\\b${escapeRegExp(safeField)}\\b`, "i").test(evidence)) return safeField;
  }
  return undefined;
}

function normalizeInputField(value: string): SafeInputField | undefined {
  const normalized = value.trim().toLowerCase();
  return (SAFE_INPUT_FIELDS as readonly string[]).includes(normalized) ? normalized as SafeInputField : undefined;
}

function safeErrorCode(values: SafeScalar[]): DiagnosticCode {
  for (const value of values) {
    if (typeof value === "number" && Number.isInteger(value) && Math.abs(value) <= 999999) return value;
    if (typeof value !== "string") continue;
    const normalized = value.trim().toLowerCase().replace(/[ -]+/g, "_");
    if (/^\d{1,6}$/.test(normalized)) return Number(normalized);
    if (SAFE_ERROR_CODES.has(normalized)) return normalized;
  }
  return null;
}

function hasAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function limitSummary(value: string): string {
  return value.slice(0, MAX_SUMMARY_LENGTH);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isScalar(value: unknown): value is SafeScalar {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
