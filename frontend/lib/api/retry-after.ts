/** Parse HTTP Retry-After without allowing invalid or unbounded UI timers. */
export function retryAfterSeconds(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (!value || value.length > 128) return undefined;
  const input = value.trim();
  const seconds = /^\d+$/.test(input)
    ? Number(input)
    : /^[A-Za-z]{3},/.test(input)
      ? Math.ceil((Date.parse(input) - now) / 1000)
      : NaN;
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return Math.min(seconds, 86400);
}
