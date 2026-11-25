import { z } from "zod";

const errorEnvelope = z.object({
  message: z.string().optional(),
  meta: z.object({ requestId: z.string().optional() }).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string().optional(),
      fields: z.unknown().optional(),
      details: z.unknown().optional(),
    })
    .optional(),
});
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly requestId?: string,
    public readonly fieldErrors?: unknown,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const time = Date.parse(value);
  return Number.isFinite(time) ? Math.max(0, Math.ceil((time - now) / 1000)) : undefined;
}
export function responseError(status: number, body: unknown, headers: Headers): ApiError {
  const parsed = errorEnvelope.safeParse(body);
  const data = parsed.success ? parsed.data : undefined;
  return new ApiError(
    data?.message ??
      data?.error?.message ??
      "Could not load this information. Please try again.",
    status,
    data?.error?.code ?? "HTTP_ERROR",
    data?.meta?.requestId ?? headers.get("X-Request-ID") ?? undefined,
    data?.error?.fields ?? data?.error?.details,
    status === 429 ? parseRetryAfter(headers.get("Retry-After")) : undefined,
  );
}
