import type { CookieOptions, Response } from "express";

import { env } from "../../config/env.js";

export const sessionCookieName =
  env.NODE_ENV === "production" ? "__Host-aat_session" : "aat_session";

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
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}
