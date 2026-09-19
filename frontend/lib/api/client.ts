"use client";

import type { ApiErrorBody, ApiSuccess } from "./types";
import { errorMessage, fieldErrors, isRecord } from "./errors";

const API_ROOT = "/api/v1";
let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;
let sessionGeneration = 0;
let sessionEventSource: string | undefined;
export const SESSION_CHANGED = "aat:session-changed";

export function isExternalSessionChange(value: unknown): boolean {
  return (
    value === "changed" ||
    (isRecord(value) && value.type === "changed" && value.source !== sessionEventSource)
  );
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  readonly fields?: ApiErrorBody["error"]["fields"];

  constructor(status: number, body: unknown) {
    const record = isRecord(body) ? body : {};
    const error = isRecord(record.error) ? record.error : {};
    const code =
      typeof error.code === "string" && /^[A-Z_]{1,80}$/.test(error.code)
        ? error.code
        : "REQUEST_FAILED";
    super(errorMessage(code, status));
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fieldErrors(error.fields);
    const meta = isRecord(record.meta) ? record.meta : undefined;
    this.requestId =
      typeof meta?.requestId === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(meta.requestId)
        ? meta.requestId
        : undefined;
  }
}

export type RequestOptions = Omit<RequestInit, "body" | "credentials" | "headers"> & {
  body?: unknown;
  csrf?: boolean;
  idempotencyKey?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  // Public navigation can check for a session without treating an anonymous visitor
  // as a sign-out. This applies only to GET /auth/session, never protected actions.
  optionalSession?: true;
};

async function decode(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiSuccess<T>> {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\\r\n#]/.test(path))
    throw new Error("API path must be root-relative");
  const destination = new URL(`${API_ROOT}${path}`, "https://api.invalid");
  if (
    destination.origin !== "https://api.invalid" ||
    !destination.pathname.startsWith(`${API_ROOT}/`) ||
    /(?:^|\/)(?:\.|%2e){1,2}(?:\/|$)/i.test(path.split("?")[0]) ||
    /%2f|%5c/i.test(path.split("?")[0])
  )
    throw new Error("Invalid API path");
  const generation = sessionGeneration;
  const method = (options.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.csrf) {
    if (!csrfToken) await refreshCsrf();
    if (!csrfToken) throw new Error("A CSRF token could not be obtained");
    headers["X-CSRF-Token"] = csrfToken;
  }
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  if (generation !== sessionGeneration)
    throw new DOMException("Session changed", "AbortError");
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 20_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    method,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    credentials: "include",
    cache: "no-store",
    redirect: "error",
    signal,
  }).catch((error: unknown) => {
    if (options.signal?.aborted) throw error;
    throw new ApiError(0, {
      error: { code: timeout.aborted ? "REQUEST_TIMEOUT" : "NETWORK_ERROR" },
    });
  });
  const body = await decode(response);
  options.signal?.throwIfAborted();
  if (generation !== sessionGeneration)
    throw new DOMException("Session changed", "AbortError");
  if (!response.ok) {
    const error = new ApiError(response.status, body);
    if (error.code === "CSRF_INVALID") clearCsrfToken();
    if (
      response.status === 401 &&
      !(options.optionalSession && method === "GET" && path === "/auth/session") &&
      !(
        error.code === "AUTHENTICATION_FAILED" &&
        (path === "/auth/password/change" ||
          /^\/auth\/mfa\/factors\/[a-f0-9-]+$/i.test(path))
      ) &&
      (options.csrf ||
        /^\/(customers|staff|admin)\//.test(path) ||
        path === "/auth/sessions" ||
        path === "/auth/mfa/factors" ||
        path === "/auth/session")
    )
      invalidateSession();
    throw error;
  }
  if (
    !isRecord(body) ||
    body.success !== true ||
    typeof body.message !== "string" ||
    !isRecord(body.meta) ||
    typeof body.meta.requestId !== "string"
  ) {
    throw new ApiError(502, {
      message: "The server returned an invalid response.",
      error: { code: "INVALID_RESPONSE" },
    });
  }
  return body as ApiSuccess<T>;
}

async function obtainCsrf(): Promise<string> {
  const generation = sessionGeneration;
  const result = await apiRequest<{ csrfToken: string }>("/auth/csrf", {
    method: "POST",
    body: {},
  });
  const token = result.data?.csrfToken;
  if (typeof token !== "string" || token.length < 32 || token.length > 256)
    throw new Error("Invalid CSRF response");
  if (generation !== sessionGeneration)
    throw new DOMException("Session changed", "AbortError");
  csrfToken = token;
  return token;
}

export function refreshCsrf(): Promise<string> {
  if (csrfRequest) return csrfRequest;
  const pending = obtainCsrf().finally(() => {
    if (csrfRequest === pending) csrfRequest = null;
  });
  csrfRequest = pending;
  return pending;
}

export function invalidateSession(reason?: "password-changed"): void {
  sessionGeneration += 1;
  csrfToken = null;
  csrfRequest = null;
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(SESSION_CHANGED, { detail: reason }));
}

// Share only an invalidation event, never account data or credentials.
export function announceSessionChange(reason?: "password-changed"): void {
  invalidateSession(reason);
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("aat-session");
    sessionEventSource ??= crypto.randomUUID();
    channel.postMessage({ type: "changed", source: sessionEventSource });
    channel.close();
  }
}

export function setCsrfToken(value: unknown): void {
  csrfToken = typeof value === "string" && value.length >= 32 ? value : null;
}

export function clearCsrfToken(): void {
  csrfToken = null;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

const checkoutHosts = new Set([
  "checkout.paystack.com",
  "standard.paystack.co",
  "sdk.monnify.com",
  "sandbox.sdk.monnify.com",
]);

export function trustedCheckoutUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2_048)
    throw new Error("Invalid checkout URL");
  const parsed = new URL(value);
  if (
    parsed.protocol !== "https:" ||
    !checkoutHosts.has(parsed.hostname) ||
    parsed.port ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("The payment provider returned an untrusted checkout destination");
  }
  return parsed.href;
}

export function openTrustedCheckout(value: unknown): void {
  window.location.assign(trustedCheckoutUrl(value));
}
