/** One clock read keeps disposable sessions within the same database expiry invariant. */
export function sessionWindow(durationMs: number) {
  const expiresAt = new Date(Date.now() + durationMs);
  return { expiresAt, idleExpiresAt: expiresAt };
}
