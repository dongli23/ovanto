import { ScanAction, ScanPolicyCategory, ScanReasonCode, ScanSemanticMode, type ScanResult } from "@waffo/pancake-ts";
import { getWaffo } from "../payments/waffo";
import { GenerationError } from "./errors";

export const CONTENT_SAFETY_LOCALES = ["en", "it", "fr", "nl"] as const;
export type ContentSafetyLocale = (typeof CONTENT_SAFETY_LOCALES)[number];

const CONTENT_SAFETY_TIMEOUT_MS = 8_000;
const SAFE_POLICY_CATEGORIES = new Set<string>(Object.values(ScanPolicyCategory));
const SAFE_ACTIONS = new Set<string>(Object.values(ScanAction));
const SAFE_REASON_CODES = new Set<string>(Object.values(ScanReasonCode));

type ContentSafetyLogger = (event: Record<string, unknown>) => void;
type PromptScanner = (params: { prompt: string; semantic?: ScanSemanticMode }) => Promise<ScanResult>;

export interface ContentSafetyOptions {
  /** Test-only dependency injection; production always uses the Waffo SDK. */
  scanner?: PromptScanner;
  /** Test-only deadline override; production uses the bounded default. */
  timeoutMs?: number;
  /** Test-only logger injection; production writes one safe JSON event. */
  logger?: ContentSafetyLogger;
}

/**
 * Resolve the four UI locales without trusting arbitrary browser input.
 * A malformed or absent header falls back to a same-origin referer, then English.
 */
export function resolveContentSafetyLocale(request: Request): ContentSafetyLocale {
  const headerLocale = request.headers.get("x-ovanto-interface-locale");
  if (isContentSafetyLocale(headerLocale)) return headerLocale;

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const requestUrl = new URL(request.url);
      if (refererUrl.origin === requestUrl.origin) {
        const firstSegment = refererUrl.pathname.split("/").filter(Boolean)[0] ?? "en";
        if (isContentSafetyLocale(firstSegment)) return firstSegment;
      }
    } catch {
      // The safe default below is used for malformed referers.
    }
  }

  return "en";
}

export function isContentSafetyLocale(value: string | null | undefined): value is ContentSafetyLocale {
  return typeof value === "string" && (CONTENT_SAFETY_LOCALES as readonly string[]).includes(value);
}

/**
 * Scan a prompt and fail closed unless Waffo returns the explicit `allow` action.
 * The app locale remains in the audit event. The SDK locale is omitted because its
 * current enum does not include the app's Italian, French, or Dutch UI locales.
 */
export async function assertPromptSafe(
  prompt: string,
  locale: ContentSafetyLocale,
  options: ContentSafetyOptions = {},
): Promise<void> {
  const scanner = options.scanner ?? ((params) => getWaffo().contentSafety.scanPrompt(params));
  const logger = options.logger ?? logContentSafetyEvent;
  const timeoutMs = options.timeoutMs ?? CONTENT_SAFETY_TIMEOUT_MS;

  let verdict: ScanResult;
  try {
    verdict = await withTimeout(scanner({ prompt, semantic: ScanSemanticMode.Enforce }), timeoutMs);
  } catch {
    logger({
      timestamp: new Date().toISOString(),
      locale,
      categories: [],
      allowed: false,
      action: "error",
      reason: "service_unavailable",
    });
    throw new GenerationError("CONTENT_SAFETY_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
  }

  const action = readSafeAction(verdict?.action);
  const categories = readSafeCategories(verdict?.matchedCategories);
  const reason = readSafeReason(verdict?.reasonCode);
  const allowed = action === "allow";

  logger({
    timestamp: new Date().toISOString(),
    locale,
    categories,
    allowed,
    action,
    reason,
  });

  if (allowed) return;
  if (action === "unknown") {
    throw new GenerationError("CONTENT_SAFETY_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
  }
  if (action === "block") {
    throw new GenerationError("CONTENT_SAFETY_BLOCKED", 403, "This prompt cannot be used for generation.");
  }
  throw new GenerationError("CONTENT_SAFETY_REVIEW", 403, "This prompt requires additional review before generation.");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const safeTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : CONTENT_SAFETY_TIMEOUT_MS;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("content safety timeout")), safeTimeout);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function readSafeAction(value: unknown): "allow" | "review" | "block" | "unknown" {
  return typeof value === "string" && SAFE_ACTIONS.has(value) ? value as "allow" | "review" | "block" : "unknown";
}

function readSafeCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((category): category is string => typeof category === "string" && SAFE_POLICY_CATEGORIES.has(category))
    .slice(0, 6);
}

function readSafeReason(value: unknown): string {
  return typeof value === "string" && SAFE_REASON_CODES.has(value) ? value : "unknown";
}

function logContentSafetyEvent(event: Record<string, unknown>): void {
  console.info(JSON.stringify({ event: "content_safety", ...event }));
}
