import "server-only";
import { headers as requestHeaders } from "next/headers";
import { backendClientAddress, frontendProxySecret } from "../backend-client-address";
import { backendOrigin } from "../backend-origin";
import { privateTestingAuthorization } from "../private-testing";
import { isRecord } from "./errors";
export class PublicApiError extends Error {
  constructor(readonly status: number) {
    super("Public information is temporarily unavailable.");
  }
}
export async function publicData<T>(
  path: string,
  parse: (value: unknown) => T,
  signal?: AbortSignal,
): Promise<T> {
  if (!path.startsWith("/public/") || path.includes("..") || path.includes("\\"))
    throw new PublicApiError(400);
  const origin = backendOrigin();
  if (!origin) throw new PublicApiError(503);
  const authorization = privateTestingAuthorization();
  const clientHeaders = frontendProxySecret()
    ? backendClientAddress(
        await requestHeaders(),
        "GET",
        new URL(`/api/v1${path}`, origin).pathname,
      )
    : {};
  const response = await fetch(`${origin}/api/v1${path}`, {
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(6000)])
      : AbortSignal.timeout(6000),
    headers: {
      Accept: "application/json",
      ...clientHeaders,
      ...(authorization ? { Authorization: authorization } : {}),
    },
  });
  if (!response.ok) throw new PublicApiError(response.status);
  const body: unknown = await response.json();
  if (!isRecord(body) || body.success !== true) throw new PublicApiError(502);
  return parse(body.data);
}
