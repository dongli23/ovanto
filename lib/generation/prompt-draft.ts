export const PROMPT_DRAFT_STORAGE_KEY = "ovanto:prompt-draft";
export const PROMPT_DRAFT_MAX_LENGTH = 2_000;

export type PromptDraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function resolveStorage(storage: PromptDraftStorage | null | undefined): PromptDraftStorage | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function capPromptDraft(value: string, maxLength = PROMPT_DRAFT_MAX_LENGTH): string {
  if (typeof value !== "string" || !Number.isFinite(maxLength) || maxLength <= 0) return "";
  return value.slice(0, Math.floor(maxLength));
}

export function readPromptDraft(storage?: PromptDraftStorage | null): string {
  const target = resolveStorage(storage);
  if (!target) return "";

  try {
    const value = target.getItem(PROMPT_DRAFT_STORAGE_KEY);
    if (typeof value !== "string" || value.length > PROMPT_DRAFT_MAX_LENGTH) return "";
    return value;
  } catch {
    return "";
  }
}

export function writePromptDraft(value: string, storage?: PromptDraftStorage | null): void {
  const target = resolveStorage(storage);
  if (!target) return;

  try {
    const draft = capPromptDraft(value);
    if (!draft) {
      target.removeItem(PROMPT_DRAFT_STORAGE_KEY);
      return;
    }
    target.setItem(PROMPT_DRAFT_STORAGE_KEY, draft);
  } catch {
    // Storage can be unavailable or full; prompt editing should still work.
  }
}

export function clearPromptDraft(storage?: PromptDraftStorage | null): void {
  const target = resolveStorage(storage);
  if (!target) return;

  try {
    target.removeItem(PROMPT_DRAFT_STORAGE_KEY);
  } catch {
    // Storage can be unavailable; clearing local prompt state should still work.
  }
}
