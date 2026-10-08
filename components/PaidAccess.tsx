"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "../lib/site";

export type PaidProductKey = "image" | "edit" | "video";
export type PaidTier = "free" | "paid";

export type PaidCatalogProduct = {
  key: PaidProductKey;
  model: string;
  unitAmountCents: number;
  minQuantity: number;
  maxQuantity: number;
  enabled?: boolean;
};

export type PaidAccessState = {
  ready: boolean;
  enabled: boolean;
  tier: PaidTier;
  balance: number;
  authenticated: boolean;
  product: PaidCatalogProduct | null;
};

type SessionResponse = {
  authenticated?: unknown;
  balances?: unknown;
};

type Copy = {
  title: string;
  free: string;
  paid: string;
  model: string;
  price: string;
  credits: string;
  quantity: string;
  continuePayment: string;
  paidAccess: string;
  haveCredits: string;
  email: string;
  emailPlaceholder: string;
  sendCode: string;
  verifyCode: string;
  code: string;
  codePlaceholder: string;
  codeHint: string;
  activation: string;
  activate: string;
  loading: string;
  unavailable: string;
  invalidEmail: string;
  invalidCode: string;
  checkoutPending: string;
  checkoutError: string;
  codeSent: string;
  signedIn: string;
};

const copy: Record<Locale, Copy> = {
  en: {
    title: "Paid access",
    free: "Free",
    paid: "Paid",
    model: "Model",
    price: "Price",
    credits: "credits",
    quantity: "Quantity",
    continuePayment: "Continue to payment",
    paidAccess: "I have paid access",
    haveCredits: "I have credits",
    email: "Email",
    emailPlaceholder: "you@example.com",
    sendCode: "Send code",
    verifyCode: "Verify code",
    code: "8-digit code",
    codePlaceholder: "12345678",
    codeHint: "Enter the 8-digit code from your email.",
    activation: "Activate paid access",
    activate: "Activate",
    loading: "Loading…",
    unavailable: "Paid access is temporarily unavailable. Please try again shortly.",
    invalidEmail: "Enter a valid email address.",
    invalidCode: "Enter the 8-digit code.",
    checkoutPending: "Payment is still being confirmed. We will keep checking for up to 30 seconds.",
    checkoutError: "Payment could not be started. Please try again.",
    codeSent: "A code was sent if this email has paid access.",
    signedIn: "Paid credits are ready.",
  },
  it: {
    title: "Accesso a pagamento",
    free: "Gratis",
    paid: "A pagamento",
    model: "Modello",
    price: "Prezzo",
    credits: "crediti",
    quantity: "Quantità",
    continuePayment: "Vai al pagamento",
    paidAccess: "Ho un accesso a pagamento",
    haveCredits: "Ho dei crediti",
    email: "Email",
    emailPlaceholder: "tu@esempio.it",
    sendCode: "Invia codice",
    verifyCode: "Verifica codice",
    code: "Codice di 8 cifre",
    codePlaceholder: "12345678",
    codeHint: "Inserisci il codice di 8 cifre ricevuto via email.",
    activation: "Attiva l'accesso a pagamento",
    activate: "Attiva",
    loading: "Caricamento…",
    unavailable: "L'accesso a pagamento non è disponibile al momento. Riprova tra poco.",
    invalidEmail: "Inserisci un indirizzo email valido.",
    invalidCode: "Inserisci il codice di 8 cifre.",
    checkoutPending: "Il pagamento è ancora in verifica. Controlleremo per un massimo di 30 secondi.",
    checkoutError: "Non è stato possibile avviare il pagamento. Riprova.",
    codeSent: "Se questa email ha accesso a pagamento, è stato inviato un codice.",
    signedIn: "I crediti a pagamento sono pronti.",
  },
  fr: {
    title: "Accès payant",
    free: "Gratuit",
    paid: "Payant",
    model: "Modèle",
    price: "Prix",
    credits: "crédits",
    quantity: "Quantité",
    continuePayment: "Continuer vers le paiement",
    paidAccess: "J'ai un accès payant",
    haveCredits: "J'ai des crédits",
    email: "E-mail",
    emailPlaceholder: "vous@exemple.fr",
    sendCode: "Envoyer le code",
    verifyCode: "Vérifier le code",
    code: "Code à 8 chiffres",
    codePlaceholder: "12345678",
    codeHint: "Saisissez le code à 8 chiffres reçu par e-mail.",
    activation: "Activer l'accès payant",
    activate: "Activer",
    loading: "Chargement…",
    unavailable: "L'accès payant est momentanément indisponible. Réessayez dans un instant.",
    invalidEmail: "Saisissez une adresse e-mail valide.",
    invalidCode: "Saisissez le code à 8 chiffres.",
    checkoutPending: "Le paiement est encore en cours de confirmation. Nous vérifierons pendant 30 secondes maximum.",
    checkoutError: "Le paiement n'a pas pu démarrer. Réessayez.",
    codeSent: "Un code a été envoyé si cet e-mail dispose d'un accès payant.",
    signedIn: "Vos crédits payants sont prêts.",
  },
  nl: {
    title: "Betaalde toegang",
    free: "Gratis",
    paid: "Betaald",
    model: "Model",
    price: "Prijs",
    credits: "credits",
    quantity: "Aantal",
    continuePayment: "Doorgaan naar betaling",
    paidAccess: "Ik heb betaalde toegang",
    haveCredits: "Ik heb credits",
    email: "E-mail",
    emailPlaceholder: "jij@voorbeeld.nl",
    sendCode: "Code sturen",
    verifyCode: "Code verifiëren",
    code: "Code van 8 cijfers",
    codePlaceholder: "12345678",
    codeHint: "Voer de code van 8 cijfers uit je e-mail in.",
    activation: "Betaalde toegang activeren",
    activate: "Activeren",
    loading: "Laden…",
    unavailable: "Betaalde toegang is tijdelijk niet beschikbaar. Probeer het zo opnieuw.",
    invalidEmail: "Voer een geldig e-mailadres in.",
    invalidCode: "Voer de code van 8 cijfers in.",
    checkoutPending: "De betaling wordt nog bevestigd. We blijven maximaal 30 seconden controleren.",
    checkoutError: "De betaling kon niet worden gestart. Probeer opnieuw.",
    codeSent: "Als dit e-mailadres betaalde toegang heeft, is een code verstuurd.",
    signedIn: "Je betaalde credits staan klaar.",
  },
};

const emptyState: PaidAccessState = {
  ready: false,
  enabled: false,
  tier: "free",
  balance: 0,
  authenticated: false,
  product: null,
};

function validBalance(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function parseBalances(value: unknown): Record<PaidProductKey, number> {
  if (!value || typeof value !== "object") return { image: 0, edit: 0, video: 0 };
  const balances = value as Record<string, unknown>;
  return {
    image: validBalance(balances.image),
    edit: validBalance(balances.edit),
    video: validBalance(balances.video),
  };
}

function parseProduct(value: unknown, kind: PaidProductKey): PaidCatalogProduct | null {
  if (!value || typeof value !== "object") return null;
  const product = value as Record<string, unknown>;
  if (product.key !== kind || typeof product.model !== "string" || !product.model.trim() || product.enabled === false) return null;
  const unitAmountCents = product.unitAmountCents;
  const minQuantity = product.minQuantity;
  const maxQuantity = product.maxQuantity;
  if (typeof unitAmountCents !== "number" || !Number.isSafeInteger(unitAmountCents) || unitAmountCents <= 0) return null;
  if (typeof minQuantity !== "number" || !Number.isSafeInteger(minQuantity) || minQuantity < 1 || minQuantity > 20) return null;
  if (typeof maxQuantity !== "number" || !Number.isSafeInteger(maxQuantity) || maxQuantity < minQuantity || maxQuantity > 20) return null;
  return { key: kind, model: product.model.trim(), unitAmountCents, minQuantity, maxQuantity, enabled: true };
}

function checkoutUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.toLowerCase() === "checkout.stripe.com" && !parsed.username && !parsed.password && !parsed.port;
  } catch {
    return false;
  }
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return "00000000-0000-4000-8000-000000000000";
}

async function json<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function apiCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const body = payload as { code?: unknown; error?: { code?: unknown } };
  return typeof body.error?.code === "string" ? body.error.code : typeof body.code === "string" ? body.code : undefined;
}

function formatPrice(locale: Locale, cents: number): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(cents / 100);
}

export function PaidAccess({
  locale,
  kind,
  busy = false,
  refreshSignal = 0,
  remainingFromGeneration,
  onStateChange,
}: {
  locale: Locale;
  kind: PaidProductKey;
  busy?: boolean;
  refreshSignal?: number;
  remainingFromGeneration?: number;
  onStateChange?: (state: PaidAccessState) => void;
}) {
  const localized = copy[locale];
  const [catalogChecked, setCatalogChecked] = useState(false);
  const [product, setProduct] = useState<PaidCatalogProduct | null>(null);
  const [catalogEnabled, setCatalogEnabled] = useState(false);
  const [tier, setTier] = useState<PaidTier>("free");
  const [balance, setBalance] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [checkoutState, setCheckoutState] = useState<"idle" | "loading" | "pending" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<"hidden" | "access" | "credits">("hidden");
  const [email, setEmail] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [activationToken, setActivationToken] = useState<string | null>(null);
  const [activationBusy, setActivationBusy] = useState(false);
  const checkoutIdentity = useRef<{ fingerprint: string; key: string } | null>(null);
  const claimedSession = useRef(false);

  const publish = useCallback(() => {
    onStateChange?.({
      ready: catalogChecked,
      enabled: catalogEnabled || authenticated,
      tier,
      balance,
      authenticated,
      product,
    });
  }, [authenticated, balance, catalogChecked, catalogEnabled, onStateChange, product, tier]);

  useEffect(() => {
    publish();
  }, [publish]);

  const applySession = useCallback((payload: SessionResponse | null) => {
    const isAuthenticated = payload?.authenticated === true;
    const nextBalance = isAuthenticated ? parseBalances(payload?.balances)[kind] : 0;
    setAuthenticated(isAuthenticated);
    setBalance(nextBalance);
    if (nextBalance > 0) setTier("paid");
  }, [kind]);

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch("/api/account/session", { cache: "no-store" });
      const payload = await json<SessionResponse>(response);
      if (!response.ok || !payload) throw new Error("session");
      applySession(payload);
    } catch {
      setAuthenticated(false);
      setBalance(0);
    }
  }, [applySession]);

  const loadCatalog = useCallback(async () => {
    try {
      const response = await fetch("/api/stripe/catalog", { cache: "no-store" });
      const payload = await json<{ enabled?: unknown; products?: unknown }>(response);
      const entries = payload && Array.isArray(payload.products) ? payload.products : [];
      const nextProduct = payload?.enabled === true ? entries.map((entry) => parseProduct(entry, kind)).find(Boolean) ?? null : null;
      setProduct(nextProduct);
      setCatalogEnabled(Boolean(nextProduct));
      setCatalogChecked(true);
      if (nextProduct) setQuantity((previous) => Math.min(nextProduct.maxQuantity, Math.max(nextProduct.minQuantity, previous || nextProduct.minQuantity)));
    } catch {
      setProduct(null);
      setCatalogEnabled(false);
      setCatalogChecked(true);
    }
  }, [kind]);

  useEffect(() => {
    void Promise.allSettled([loadCatalog(), loadSession()]);
  }, [loadCatalog, loadSession]);

  useEffect(() => {
    if (refreshSignal > 0) void loadSession();
  }, [loadSession, refreshSignal]);

  useEffect(() => {
    if (typeof remainingFromGeneration !== "number" || remainingFromGeneration < 0) return;
    setBalance(remainingFromGeneration);
    if (remainingFromGeneration > 0) setTier("paid");
  }, [remainingFromGeneration]);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const token = new URLSearchParams(hash.slice(1)).get("activate");
    if (!token) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setActivationToken(token);
  }, []);

  const removeCheckoutQuery = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("session_id");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const claimCheckout = useCallback(async () => {
    if (claimedSession.current || !new URLSearchParams(window.location.search).has("session_id")) return;
    claimedSession.current = true;
    setCheckoutState("loading");
    setMessage(null);
    const deadline = Date.now() + 30_000;
    let delay = 500;
    try {
      while (true) {
        const response = await fetch("/api/account/claim", { method: "POST", cache: "no-store" });
        const payload = await json<SessionResponse>(response);
        if (response.ok && payload) {
          applySession(payload);
          removeCheckoutQuery();
          setCheckoutState("idle");
          setMessage(localized.signedIn);
          return;
        }
        if (response.status === 409 && apiCode(payload) === "CHECKOUT_PENDING" && Date.now() < deadline) {
          await new Promise((resolve) => window.setTimeout(resolve, Math.min(delay, Math.max(0, deadline - Date.now()))));
          delay = Math.min(delay * 2, 4_000);
          continue;
        }
        throw new Error(apiCode(payload) || "claim");
      }
    } catch (error) {
      setCheckoutState("error");
      setMessage(error instanceof Error && error.message === "CHECKOUT_PENDING" ? localized.checkoutPending : localized.checkoutError);
    }
  }, [applySession, localized.checkoutError, localized.checkoutPending, localized.signedIn, removeCheckoutQuery]);

  useEffect(() => {
    void claimCheckout();
  }, [claimCheckout]);

  const activate = async () => {
    if (!activationToken || activationBusy) return;
    setActivationBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/account/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: activationToken }),
      });
      const payload = await json<SessionResponse>(response);
      if (!response.ok || !payload) throw new Error(apiCode(payload) || "activate");
      applySession(payload);
      setActivationToken(null);
      setMessage(localized.signedIn);
    } catch {
      setMessage(localized.unavailable);
    } finally {
      setActivationBusy(false);
    }
  };

  const requestLoginCode = async () => {
    const trimmedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setMessage(localized.invalidEmail);
      return;
    }
    setAccountBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/account/login/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const payload = await json<unknown>(response);
      if (!response.ok) throw new Error(apiCode(payload) || "login-request");
      setCodeSent(true);
      setMessage(localized.codeSent);
    } catch {
      setMessage(localized.unavailable);
    } finally {
      setAccountBusy(false);
    }
  };

  const verifyLoginCode = async () => {
    const trimmedEmail = email.trim();
    if (!/^\d{8}$/.test(loginCode.trim())) {
      setMessage(localized.invalidCode);
      return;
    }
    setAccountBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/account/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, code: loginCode.trim() }),
      });
      const payload = await json<SessionResponse>(response);
      if (!response.ok || !payload) throw new Error(apiCode(payload) || "login-verify");
      applySession(payload);
      setAccountMode("hidden");
      setCodeSent(false);
      setMessage(localized.signedIn);
    } catch {
      setMessage(localized.unavailable);
    } finally {
      setAccountBusy(false);
    }
  };

  const startCheckout = async () => {
    if (!product || checkoutState === "loading") return;
    const maxQuantity = Math.min(20, product.maxQuantity);
    const safeQuantity = Math.min(maxQuantity, Math.max(product.minQuantity, quantity));
    const fingerprint = `${kind}:${safeQuantity}`;
    if (!checkoutIdentity.current || checkoutIdentity.current.fingerprint !== fingerprint) {
      checkoutIdentity.current = { fingerprint, key: newIdempotencyKey() };
    }
    setCheckoutState("loading");
    setMessage(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", "idempotency-key": checkoutIdentity.current.key },
        body: JSON.stringify({ product: kind, quantity: safeQuantity, returnPath: window.location.pathname }),
      });
      const payload = await json<{ url?: unknown } & Record<string, unknown>>(response);
      if (!response.ok || !payload || !checkoutUrl(payload.url)) throw new Error(apiCode(payload) || "checkout");
      window.location.assign(payload.url);
    } catch {
      setCheckoutState("error");
      setMessage(localized.checkoutError);
    }
  };

  const productPrice = useMemo(() => product ? formatPrice(locale, product.unitAmountCents) : "", [locale, product]);
  const maxQuantity = product ? Math.min(20, product.maxQuantity) : 1;
  const visible = catalogChecked && ((catalogEnabled && product !== null) || authenticated);
  if (!visible && !activationToken) return null;

  return (
    <section className="paid-access" aria-label={localized.title}>
      {activationToken ? (
        <div className="paid-activation">
          <p className="paid-section-title">{localized.activation}</p>
          <button type="button" className="paid-secondary-button" onClick={activate} disabled={activationBusy}>
            {activationBusy ? localized.loading : localized.activate}
          </button>
        </div>
      ) : null}
      {visible ? (
        <>
          <div className="paid-tier-row" role="group" aria-label={localized.title}>
            <button type="button" className={`paid-tier ${tier === "free" ? "is-selected" : ""}`} onClick={() => setTier("free")} disabled={busy}>
              {localized.free}
            </button>
            <button type="button" className={`paid-tier ${tier === "paid" ? "is-selected" : ""}`} onClick={() => setTier("paid")} disabled={busy}>
              {localized.paid}
            </button>
            <span className="paid-balance" aria-live="polite">{balance} {localized.credits}</span>
          </div>
          {tier === "paid" ? (
            <div className="paid-details">
              {product ? (
                <>
                  <div className="paid-product-copy">
                    <span><strong>{localized.model}:</strong> {product.model}</span>
                    <span><strong>{localized.price}:</strong> {productPrice}</span>
                  </div>
                  <label className="paid-quantity">
                    <span>{localized.quantity}</span>
                    <input
                      type="number"
                      min={product.minQuantity}
                      max={maxQuantity}
                      step={1}
                      value={quantity}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) setQuantity(Math.min(maxQuantity, Math.max(product.minQuantity, Math.trunc(value))));
                      }}
                      disabled={busy || checkoutState === "loading"}
                    />
                  </label>
                </>
              ) : null}
              {balance > 0 ? <p className="paid-status">{localized.signedIn}</p> : null}
              {product && balance <= 0 ? (
                <>
                  <button type="button" className="paid-payment-button" onClick={startCheckout} disabled={checkoutState === "loading"}>
                    {checkoutState === "loading" ? localized.loading : localized.continuePayment}
                  </button>
                  <nav className="paid-product-copy" aria-label="Payment information">
                    <a href="/terms/">Terms</a>
                    <a href="/privacy/">Privacy</a>
                    <a href="/terms/#refunds">Refund policy</a>
                  </nav>
                </>
              ) : null}
              {!authenticated ? (
                <div className="paid-account-actions">
                  {accountMode === "hidden" ? (
                    <>
                      <button type="button" className="paid-secondary-button" onClick={() => setAccountMode("access")}>{localized.paidAccess}</button>
                      <button type="button" className="paid-secondary-button" onClick={() => setAccountMode("credits")}>{localized.haveCredits}</button>
                    </>
                  ) : (
                    <div className="paid-login-panel">
                      <label>
                        <span>{localized.email}</span>
                        <input type="email" value={email} placeholder={localized.emailPlaceholder} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
                      </label>
                      <button type="button" className="paid-secondary-button" onClick={requestLoginCode} disabled={accountBusy}>{accountBusy ? localized.loading : localized.sendCode}</button>
                      {codeSent ? (
                        <>
                          <label>
                            <span>{localized.code}</span>
                            <input type="text" value={loginCode} placeholder={localized.codePlaceholder} inputMode="numeric" maxLength={8} onChange={(event) => setLoginCode(event.target.value.replace(/\D/g, "").slice(0, 8))} autoComplete="one-time-code" />
                          </label>
                          <p className="paid-code-hint">{localized.codeHint}</p>
                          <button type="button" className="paid-secondary-button" onClick={verifyLoginCode} disabled={accountBusy}>{accountBusy ? localized.loading : localized.verifyCode}</button>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
          {message ? <p className={`paid-message ${checkoutState === "error" ? "is-error" : ""}`} role="status">{message}</p> : null}
        </>
      ) : null}
    </section>
  );
}

export const defaultPaidAccessState = emptyState;
