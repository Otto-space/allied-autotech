import { z } from "zod";
import { apiRequest, ApiError, invalidateSession, newIdempotencyKey } from "./client";
import { parseCustomerPurchaseDetail } from "./customer-purchase-detail-schema";
import {
  clearReservationRetry,
  parseReservationTerms,
  readReservationRetry,
  saveReservationRetry,
  type ReservationIntent,
  type TermsDocument,
} from "./reservation-terms";

export type ReservationPurchase = ReturnType<typeof parseCustomerPurchaseDetail>;
const changed = () => new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
export async function confirmReservation({
  owner,
  record,
  document,
  retry,
  signal,
}: {
  owner: string;
  record: ReservationPurchase;
  document?: TermsDocument;
  retry?: ReservationIntent;
  signal: AbortSignal;
}) {
  const path = `/customers/vehicle-transactions/${record.id}`;
  const session = z
    .object({ user: z.object({ id: z.uuid(), role: z.string() }) })
    .parse((await apiRequest("/auth/session", { signal })).data);
  if (session.user.id !== owner || session.user.role !== "CUSTOMER") {
    invalidateSession();
    throw changed();
  }
  let intent: ReservationIntent;
  if (retry) {
    // Replays must use the original request even after withdrawal or purchase expiry.
    const stored = readReservationRetry(owner, record.id);
    if (
      stored?.kind !== "pending" ||
      JSON.stringify(stored.intent) !== JSON.stringify(retry)
    )
      throw changed();
    intent = stored.intent;
  } else {
    if (!document || record.status !== "NEGOTIATING" || record.agreedPriceKobo === null)
      throw changed();
    const [purchaseResponse, termsResponse] = await Promise.all([
      apiRequest(path, { signal }),
      apiRequest(`${path}/reservation-terms`, { signal }),
    ]);
    const latest = parseCustomerPurchaseDetail(purchaseResponse.data);
    const terms = parseReservationTerms(termsResponse.data);
    if (
      latest.id !== record.id ||
      latest.version !== record.version ||
      latest.status !== record.status ||
      latest.agreedPriceKobo !== record.agreedPriceKobo ||
      latest.reservationRequiredKobo !== record.reservationRequiredKobo ||
      latest.termsAcceptedAt !== null ||
      terms.accepted ||
      terms.legacyAcceptance ||
      !terms.current ||
      JSON.stringify(terms.current) !== JSON.stringify(document)
    )
      throw changed();
    // Check after asynchronous reads, before saving: another open review may have sent.
    if (readReservationRetry(owner, record.id) !== undefined) throw changed();
    intent = {
      owner,
      transactionId: record.id,
      key: newIdempotencyKey(),
      startedAt: Date.now(),
      body: {
        expectedVersion: record.version,
        termsVersion: document.version,
        termsAccepted: true,
      },
    };
    signal.throwIfAborted();
    saveReservationRetry(intent); // If storage fails, no reservation is sent.
  }
  signal.throwIfAborted();
  try {
    const response = await apiRequest(`${path}/reserve`, {
      method: "POST",
      csrf: true,
      idempotencyKey: intent.key,
      body: intent.body,
      signal,
    });
    const result = z
      .object({ transaction: z.unknown(), replayed: z.boolean() })
      .parse(response.data);
    const saved = parseCustomerPurchaseDetail(result.transaction);
    if (
      saved.id !== record.id ||
      saved.termsVersion !== intent.body.termsVersion ||
      saved.termsAcceptedAt === null ||
      saved.version <= intent.body.expectedVersion
    )
      throw new Error("Reservation outcome unconfirmed");
    clearReservationRetry(owner, record.id);
    return { transaction: saved, replayed: result.replayed };
  } catch (error) {
    // A rejected replay cannot prove the earlier request failed. Keep its boundary.
    if (
      !retry &&
      !signal.aborted &&
      error instanceof ApiError &&
      error.status >= 400 &&
      error.status < 500
    )
      clearReservationRetry(owner, record.id);
    throw error;
  }
}
