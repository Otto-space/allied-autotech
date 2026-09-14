import "server-only";
import { isRecord } from "./errors";
export class PublicApiError extends Error {
  constructor(readonly status: number) {
    super("Public information is temporarily unavailable.");
  }
}
export async function publicData<T>(
  path: string,
  parse: (value: unknown) => T,
): Promise<T> {
  if (!path.startsWith("/public/") || path.includes("..") || path.includes("\\"))
    throw new PublicApiError(400);
  const origin = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:5000";
  const response = await fetch(`${origin}/api/v1${path}`, {
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(6000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new PublicApiError(response.status);
  const body: unknown = await response.json();
  if (!isRecord(body) || body.success !== true) throw new PublicApiError(502);
  return parse(body.data);
}
