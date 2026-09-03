import { generateOpaqueToken, hashToken } from "./session-tokens.js";
import { timingSafeStringEqual } from "./timing-safe.js";

export function issueCsrfToken(): { raw: string; hash: string } {
  const raw = generateOpaqueToken();
  return { raw, hash: hashToken("csrf", raw) };
}

export function verifyCsrfToken(raw: string, expectedHash: string): boolean {
  return timingSafeStringEqual(hashToken("csrf", raw), expectedHash);
}
