import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export const clientProofHeaders = [
  "x-allied-client-ip",
  "x-allied-client-time",
  "x-allied-client-proof",
] as const;
export function frontendProxySecret() {
  const secret = process.env.FRONTEND_PROXY_SECRET?.trim();
  if (
    secret &&
    (!/^[A-Za-z0-9+/]{43}=$/.test(secret) || Buffer.from(secret, "base64").length !== 32)
  )
    throw new Error(
      "FRONTEND_PROXY_SECRET must be an independent 32-byte Base64 secret.",
    );
  return secret;
}
export function backendClientAddress(
  incoming: Pick<Headers, "get">,
  method: string,
  pathname: string,
): Record<string, string> {
  const secret = frontendProxySecret();
  if (!secret) return {};
  // Vercel overwrites this platform header. Never sign caller-supplied custom
  // proof headers, XFF, or a query parameter. Cloudflare must remain DNS-only.
  const ip =
    process.env.VERCEL === "1"
      ? incoming.get("x-vercel-forwarded-for")?.trim()
      : undefined;
  if (!ip || !isIP(ip)) throw new Error("Verified Vercel client address is unavailable.");
  const time = String(Math.floor(Date.now() / 1000));
  return {
    "x-allied-client-ip": ip,
    "x-allied-client-time": time,
    "x-allied-client-proof": createHmac("sha256", Buffer.from(secret, "base64"))
      .update(`allied-client-v1\n${method}\n${pathname}\n${ip}\n${time}`)
      .digest("hex"),
  };
}
