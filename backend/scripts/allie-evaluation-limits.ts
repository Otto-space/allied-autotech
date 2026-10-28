// Uncached Standard rates verified 2026-10-27; do not reuse for another model.
export const evaluationRates = {
  inputUsdPerMillion: 0.1,
  outputUsdPerMillion: 0.5,
} as const;
export type EvaluationReservation = { at: number; tokens: number };
export function evaluationRequestReserve(bodyBytes: number) {
  if (!Number.isInteger(bodyBytes) || bodyBytes < 1 || bodyBytes > 65536)
    throw new Error("Invalid evaluation request size");
  const inputTokens = bodyBytes + 2048;
  return {
    tokens: inputTokens + 1200,
    usd:
      (inputTokens * evaluationRates.inputUsdPerMillion +
        1200 * evaluationRates.outputUsdPerMillion) /
      1e6,
  };
}
export function evaluationAdmissionDelay(
  now: number,
  lastAt: number,
  reservations: EvaluationReservation[],
  tokens: number,
) {
  if (!Number.isInteger(tokens) || tokens < 1 || tokens > 54000)
    throw new Error("Invalid evaluation admission size");
  const current = reservations.filter((r) => r.at > now - 61000);
  return now - lastAt >= 6500 &&
    current.length < 9 &&
    current.reduce((n, r) => n + r.tokens, 0) + tokens <= 54000
    ? 0
    : 1000;
}
export function evaluationBudgetAllows(
  requests: number,
  reservedUsd: number,
  maxRequests: number,
  ownerUsd: number,
  nextUsd: number,
) {
  if (
    ![requests, reservedUsd, maxRequests, ownerUsd, nextUsd].every(Number.isFinite) ||
    !Number.isInteger(requests) ||
    !Number.isInteger(maxRequests) ||
    requests < 0 ||
    reservedUsd < 0 ||
    maxRequests < 1 ||
    maxRequests > 120 ||
    ownerUsd <= 0 ||
    nextUsd <= 0
  )
    return false;
  return requests < maxRequests && reservedUsd + nextUsd <= Math.min(ownerUsd, 1);
}
