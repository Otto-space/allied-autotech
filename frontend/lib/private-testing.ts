import { timingSafeEqual } from "node:crypto";

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
