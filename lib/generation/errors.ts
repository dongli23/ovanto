import { NextResponse } from "next/server";

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 502 | 503;

export class GenerationError extends Error {
  readonly status: ErrorStatus;
  readonly code: string;
  readonly publicMessage?: string;

  constructor(code: string, status: ErrorStatus, publicMessage?: string) {
    super(publicMessage ?? code);
    this.name = "GenerationError";
    this.status = status;
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export function isGenerationError(error: unknown): error is GenerationError {
  return error instanceof GenerationError;
}

export function errorResponse(error: unknown): NextResponse {
  if (isGenerationError(error)) {
    const body: { error: { code: string; message?: string } } = {
      error: { code: error.code },
    };
    if (error.publicMessage) body.error.message = error.publicMessage;
    return NextResponse.json(body, {
      status: error.status,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Try again." } },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export function configError(missing: string[]): GenerationError {
  return new GenerationError(
    "CONFIGURATION_UNAVAILABLE",
    503,
    missing.length > 0 ? "Generation is temporarily unavailable." : undefined,
  );
}

export function storageError(): GenerationError {
  return new GenerationError("STORAGE_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
}
