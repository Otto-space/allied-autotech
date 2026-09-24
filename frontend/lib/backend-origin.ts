/** Server configuration shared by Next.js rewrites and server-rendered API reads. */
export function backendOrigin(): string | undefined {
  const hostedOnVercel =
    process.env.VERCEL === "1" && process.env.VERCEL_ENV !== "development";
  const configured = process.env.BACKEND_ORIGIN?.trim();
  // A Vercel deployment can preview the frontend before an API is connected.
  if (hostedOnVercel && !configured) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(configured || "http://127.0.0.1:5000");
  } catch {
    throw new Error("BACKEND_ORIGIN must be a valid HTTP or HTTPS origin.");
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  ) {
    throw new Error(
      "BACKEND_ORIGIN must contain only an origin without credentials, an API path, query or fragment.",
    );
  }
  const localHost =
    ["localhost", "backend", "0.0.0.0", "[::1]"].includes(parsed.hostname) ||
    /^127\.\d+\.\d+\.\d+$/.test(parsed.hostname) ||
    parsed.hostname.endsWith(".localhost");
  if (hostedOnVercel && (parsed.protocol !== "https:" || localHost)) {
    throw new Error(
      "BACKEND_ORIGIN must be a reachable HTTPS API origin on Vercel. For a backend on your PC, use its HTTPS tunnel URL instead of localhost.",
    );
  }
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && localHost)) {
    throw new Error("BACKEND_ORIGIN must use HTTPS outside local/container development.");
  }
  return parsed.origin;
}
