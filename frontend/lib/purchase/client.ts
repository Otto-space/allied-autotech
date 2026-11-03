"use client";
import { z } from "zod";
import {
  apiRequest,
  ApiError,
  SESSION_CHANGED,
  type RequestOptions,
} from "../api/client";

export const PURCHASE_ACCESS_CHANGED = "aat:purchase-access-changed";
const changeKey = "aat:purchase-access:changed";
let csrf: string | undefined;
let generation = 0;
let csrfRequest: Promise<string> | undefined;
const listeners = new Set<() => void>();
const tokenSchema = z.object({ csrfToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
export const purchaseAccessSchema = z.object({
  email: z.email(),
  buyerReference: z.uuid(),
  expiresAt: z.iso.datetime({ offset: true }),
});
function changed() {
  generation++;
  csrf = undefined;
  csrfRequest = undefined;
  for (const callback of listeners) callback();
}
function storage(event: StorageEvent) {
  if (event.key === changeKey) changed();
}
export function subscribePurchaseAccess(callback: () => void) {
  if (listeners.size === 0) {
    window.addEventListener(SESSION_CHANGED, changed);
    window.addEventListener("storage", storage);
  }
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      window.removeEventListener(SESSION_CHANGED, changed);
      window.removeEventListener("storage", storage);
    }
  };
}
export function announcePurchaseAccess() {
  changed();
  try {
    localStorage.setItem(changeKey, `${Date.now()}:${crypto.randomUUID()}`);
  } catch {
    /* Cross-tab refresh still rechecks access. */
  }
}
async function requestCsrf() {
  const version = generation;
  const result = await apiRequest("/purchase/access/csrf", { method: "POST", body: {} });
  const token = tokenSchema.parse(result.data).csrfToken;
  if (version !== generation)
    throw new DOMException("Purchase access changed", "AbortError");
  csrf = token;
  return token;
}
async function obtainCsrf() {
  if (csrf) return csrf;
  if (!csrfRequest) {
    const pending = requestCsrf().finally(() => {
      if (csrfRequest === pending) csrfRequest = undefined;
    });
    csrfRequest = pending;
  }
  return csrfRequest;
}
export async function purchaseRequest(path: string, options: RequestOptions = {}) {
  if (!path.startsWith("/purchase/")) throw Error("Invalid purchase destination");
  const version = generation;
  const method = (options.method ?? "GET").toUpperCase();
  const needsCsrf =
    !["GET", "HEAD"].includes(method) &&
    ![
      "/purchase/access/request",
      "/purchase/access/verify",
      "/purchase/access/csrf",
    ].includes(path);
  const headers = {
    ...options.headers,
    ...(needsCsrf ? { "X-CSRF-Token": await obtainCsrf() } : {}),
  };
  if (version !== generation)
    throw new DOMException("Purchase access changed", "AbortError");
  try {
    const result = await apiRequest(path, { ...options, csrf: false, headers });
    if (version !== generation)
      throw new DOMException("Purchase access changed", "AbortError");
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && path !== "/purchase/access")
      changed();
    else if (error instanceof ApiError && error.code === "CSRF_INVALID") csrf = undefined;
    throw error;
  }
}
