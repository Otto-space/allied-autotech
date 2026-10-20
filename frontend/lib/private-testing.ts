import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const privateTestingCookieName = "__Host-aat_private_access";
export const privateTestingCookieSeconds = 8 * 60 * 60;

function cookieSignature(value: string, host: string, authorization: string) {
  return createHmac("sha256", authorization)
    .update(`allied-private-access\n${host}\n${value}`)
    .digest("hex");
}

// Signed, host-bound bearer proof. Never store the shared password in a cookie.
// Password rotation invalidates all proofs; ordinary requests do not extend expiry.
export function createPrivateTestingCookie(
  host: string,
  authorization: string,
  now = Date.now(),
): string {
  const expires = Math.floor(now / 1000) + privateTestingCookieSeconds;
  const value = `v1.${expires}.${randomBytes(16).toString("hex")}`;
  return `${value}.${cookieSignature(value, host, authorization)}`;
}

export function privateTestingCookieAllowed(
  cookie: string | undefined,
  host: string,
  authorization: string,
  now = Date.now(),
): boolean {
  const match = /^v1\.([0-9]{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(cookie ?? "");
  if (!match) return false;
  const remaining = Number(match[1]) - Math.floor(now / 1000);
  if (remaining <= 0 || remaining > privateTestingCookieSeconds) return false;
  const value = `v1.${match[1]}.${match[2]}`;
  return timingSafeEqual(
    Buffer.from(match[3], "hex"),
    Buffer.from(cookieSignature(value, host, authorization), "hex"),
  );
}

// Server use only (Proxy, deployment configuration and server-only API client).
// Never expose this setting through NEXT_PUBLIC_* or a response header.
export function privateTestingAuthorization(): string | undefined {
  const enabled = process.env.PRIVATE_TESTING_ENABLED;
  if (enabled === undefined || enabled === "false") return undefined;
  if (enabled !== "true")
    throw new Error("PRIVATE_TESTING_ENABLED must be true or false.");
  const password = process.env.PRIVATE_TESTING_PASSWORD;
  if (!/^[a-f0-9]{64}$/.test(password ?? ""))
    throw new Error("Private testing requires a generated 32-byte hexadecimal password.");
  return `Basic ${Buffer.from(`allied-test:${password}`).toString("base64")}`;
}

export function privateTestingAllowed(
  provided: string | null,
  expected: string,
): boolean {
  const match = /^Basic ([A-Za-z0-9+/]+=*)$/i.exec(provided ?? "");
  const actual = Buffer.from(match ? `Basic ${match[1]}` : "");
  const target = Buffer.from(expected);
  return actual.length === target.length && timingSafeEqual(actual, target);
}
