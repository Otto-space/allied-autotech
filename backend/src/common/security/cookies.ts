import type { CookieOptions, Response } from "express";

import { env } from "../../config/env.js";

export const sessionCookieName =
  env.NODE_ENV === "production" ? "__Host-aat_session" : "aat_session";
export const purchaseCookieName =
  env.NODE_ENV === "production" ? "__Host-aat_purchase" : "aat_purchase";
export const purchaseBrowserCookieName =
  env.NODE_ENV === "production" ? "__Host-aat_purchase_browser" : "aat_purchase_browser";

export function sessionCookieOptions(expiresAt: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  };
}

export function setSessionCookie(
  response: Response,
  rawToken: string,
  expiresAt: Date,
): void {
  response.cookie(sessionCookieName, rawToken, sessionCookieOptions(expiresAt));
  // Account and guest identities must never coexist in the same browser jar.
  clearPurchaseCookies(response);
}

export function clearPurchaseCookies(response: Response): void {
  for (const name of [purchaseCookieName, purchaseBrowserCookieName])
    response.clearCookie(name, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}
