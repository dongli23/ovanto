import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { GenerationError } from "./errors";
import { COOKIE_NAME } from "./config";

export interface CookieOptions {
  httpOnly?: boolean;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  path?: string;
  maxAge?: number;
}

export interface CookieStoreLike {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: CookieOptions): void;
}

export interface TrustedIdentity {
  readonly ip: string;
  readonly country: string;
  readonly ipHash: string;
  readonly ownerId: string;
}

export function getDailyIdentity(request: Request, cookieStore: CookieStoreLike): TrustedIdentity {
  const network = getTrustedNetworkIdentity(request);
  const secret = process.env.IP_HASH_SECRET;
  if (!secret) throw new GenerationError("CONFIGURATION_UNAVAILABLE", 503, "Generation is temporarily unavailable.");

  const ipHash = createHmac("sha256", secret).update(network.ip).digest("hex");
  const ownerId = getOrCreateOwner(cookieStore, secret);
  return { ...network, ipHash, ownerId };
}

export function getTrustedNetworkIdentity(request: Request): { ip: string; country: string } {
  if (process.env.VERCEL === "1") {
    // x-vercel-forwarded-for and x-vercel-ip-country are Vercel platform
    // headers. User-controlled x-forwarded-for/cf-country headers are never
    // consulted here.
    const forwarded = request.headers.get("x-vercel-forwarded-for");
    const ip = normalizeIp(forwarded?.split(",", 1)[0]?.trim() ?? "");
    const country = normalizeCountry(request.headers.get("x-vercel-ip-country"));
    if (!ip) throw new GenerationError("TRUSTED_IDENTITY_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
    if (!country) throw new GenerationError("COUNTRY_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
    return { ip, country };
  }

  if (process.env.NODE_ENV !== "production" && process.env.DEV_ALLOW_LOCAL_REQUESTS === "true") {
    return { ip: "127.0.0.1", country: "US" };
  }

  throw new GenerationError("TRUSTED_IDENTITY_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
}

export function assertFreeRegion(country: string): void {
  if (country === "IN" || country === "RU") {
    throw new GenerationError("REGION_BLOCKED", 429, "Free generation is unavailable in this region.");
  }
  if (!country || country === "ZZ" || country === "XX" || country === "UN") {
    throw new GenerationError("COUNTRY_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
  }
}

/** Uploads are free-flow by default; paid routes may explicitly opt out after entitlement. */
export function assertUploadRegion(country: string, paidEntitled = false): void {
  if (paidEntitled) {
    if (!country || country === "ZZ" || country === "XX" || country === "UN") {
      throw new GenerationError("COUNTRY_UNAVAILABLE", 503, "Generation is temporarily unavailable.");
    }
    return;
  }
  assertFreeRegion(country);
}

export function assertSameSiteOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new GenerationError("ORIGIN_MISMATCH", 403, "Request origin is not allowed.");
  }
  if (originUrl.origin === "null") {
    throw new GenerationError("ORIGIN_MISMATCH", 403, "Request origin is not allowed.");
  }

  const allowed = new Set<string>(["https://ovanto.ai"]);
  if (process.env.NODE_ENV !== "production" && process.env.DEV_ALLOW_LOCAL_REQUESTS === "true") {
    try {
      allowed.add(new URL(request.url).origin);
    } catch {
      // The request URL is validated by the Fetch API. Keep the allowlist
      // canonical if a test double provides a malformed URL.
    }
  }

  let requestOrigin: string | undefined;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    requestOrigin = undefined;
  }
  if (requestOrigin) allowed.add(requestOrigin);
  if (!allowed.has(originUrl.origin)) {
    throw new GenerationError("ORIGIN_MISMATCH", 403, "Request origin is not allowed.");
  }
}

function normalizeIp(value: string): string | undefined {
  if (!value) return undefined;
  let candidate = value.trim();
  if (candidate.startsWith("[") && candidate.endsWith("]")) candidate = candidate.slice(1, -1);
  if (isIP(candidate)) return candidate;
  // Vercel normally sends a bare IPv4 address. Accept an accidental port only
  // for IPv4; never guess at an IPv6 suffix.
  const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort && isIP(ipv4WithPort[1]) === 4) return ipv4WithPort[1];
  return undefined;
}

function normalizeCountry(value: string | null): string | undefined {
  const country = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(country) ? country : undefined;
}

function getOrCreateOwner(cookieStore: CookieStoreLike, secret: string): string {
  const current = cookieStore.get(COOKIE_NAME)?.value;
  if (current) {
    const parsed = verifyOwnerCookie(current, secret);
    if (parsed) return parsed;
  }

  const ownerId = randomUUID();
  const signature = signOwner(ownerId, secret);
  cookieStore.set(COOKIE_NAME, `${ownerId}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
    path: "/",
    maxAge: 2 * 24 * 60 * 60,
  });
  return ownerId;
}

function signOwner(ownerId: string, secret: string): string {
  return createHmac("sha256", secret).update(`owner:${ownerId}`).digest("base64url");
}

function verifyOwnerCookie(value: string, secret: string): string | undefined {
  const separator = value.lastIndexOf(".");
  if (separator < 1) return undefined;
  const ownerId = value.slice(0, separator);
  const provided = value.slice(separator + 1);
  if (!/^[0-9a-f-]{36}$/i.test(ownerId) || !provided) return undefined;
  const expected = signOwner(ownerId, secret);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;
  return ownerId;
}

