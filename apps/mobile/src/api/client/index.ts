import { z } from "zod";
import type { paths } from "../contracts/generated";
import { successEnvelope } from "../contracts/envelope";
import { ApiError, responseError } from "../errors";
import { validateApiBaseUrl } from "./environment";

export type PublicReadPath =
  | Extract<keyof paths, "/public/capabilities" | "/public/services">
  | `/public/services/${string}`;
const serviceDetailPath = /^\/public\/services\/([0-9a-f-]+)$/i;
/** Future perimeterHeaders extension point. Deliberately not accepted or wired by this client.
 * A later reviewed dev-only runtime input may supply headers from secure storage;
 * EXPO_PUBLIC_* must never hold perimeter credentials. */
export interface FuturePerimeterHeaders {
  perimeterHeaders(): Promise<Readonly<Record<string, string>>>;
}
/** Unimplemented native session transport. No selected header or token implementation. */
export interface NativeSessionTransport {
  readonly implementation: "NOT_IMPLEMENTED";
}

export function createApiClient(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15000,
) {
  const base = validateApiBaseUrl(baseUrl);
  return {
    async get<T extends z.ZodType>(
      path: PublicReadPath,
      schema: T,
      signal?: AbortSignal,
      query?: { cursor?: string },
    ): Promise<z.infer<T>> {
      // Runtime allowlist also prevents absolute URLs, traversal and accidental writes.
      const detailMatch = serviceDetailPath.exec(path);
      const detailId = detailMatch?.[0] === path ? detailMatch[1] : undefined;
      if (
        path !== "/public/services" &&
        path !== "/public/capabilities" &&
        !z.uuid().safeParse(detailId).success
      )
        throw new ApiError("Unsupported public read", 0, "UNSUPPORTED_PATH");
      const parsedQuery = z
        .object({ cursor: z.uuid().optional() })
        .strict()
        .safeParse(query ?? {});
      if (!parsedQuery.success || (query !== undefined && path !== "/public/services"))
        throw new ApiError("Unsupported public query", 0, "UNSUPPORTED_QUERY");
      const search = parsedQuery.data.cursor
        ? new URLSearchParams({ cursor: parsedQuery.data.cursor }).toString()
        : "";
      const controller = new AbortController();
      let timedOut = false;
      const abort = () => controller.abort();
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) controller.abort();
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      try {
        if (controller.signal.aborted)
          throw new ApiError("Request cancelled.", 0, "ABORTED");
        const response = await fetcher(`${base}${path}${search ? `?${search}` : ""}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) throw responseError(response.status, body, response.headers);
        const result = successEnvelope(z.unknown()).safeParse(body);
        if (!result.success)
          throw new ApiError(
            "The response could not be verified. Please try again.",
            response.status,
            "INVALID_RESPONSE",
            response.headers.get("X-Request-ID") ?? undefined,
          );
        const data = schema.safeParse(result.data.data);
        if (!data.success)
          throw new ApiError(
            "The response could not be verified. Please try again.",
            response.status,
            "INVALID_RESPONSE",
            result.data.meta.requestId,
          );
        return data.data;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (controller.signal.aborted)
          throw new ApiError(
            timedOut ? "The request timed out. Please try again." : "Request cancelled.",
            0,
            timedOut ? "TIMEOUT" : "ABORTED",
          );
        throw new ApiError(
          "Could not connect. Check your connection and try again.",
          0,
          "NETWORK_ERROR",
        );
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    },
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;
