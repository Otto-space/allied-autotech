// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import {
  clearReservationRetry,
  readReservationRetry,
  redactReservationRetries,
  saveReservationRetry,
  type ReservationIntent,
} from "@/lib/api/reservation-terms";
const owner = "f9000000-0000-4000-8000-000000000050",
  transactionId = "f9000000-0000-4000-8000-000000000001";
const intent = (): ReservationIntent => ({
  owner,
  transactionId,
  key: crypto.randomUUID(),
  startedAt: Date.now(),
  body: { expectedVersion: 2, termsVersion: crypto.randomUUID(), termsAccepted: true },
});
beforeEach(() => sessionStorage.clear());
it("recovers the exact request, isolates owners and purchases, and clears confirmed requests", () => {
  const value = intent();
  saveReservationRetry(value);
  expect(readReservationRetry(owner, transactionId)).toEqual({
    kind: "pending",
    intent: value,
  });
  expect(readReservationRetry(crypto.randomUUID(), transactionId)).toBeUndefined();
  expect(readReservationRetry(owner, crypto.randomUUID())).toBeUndefined();
  expect(clearReservationRetry(owner, transactionId)).toBe(true);
  expect(readReservationRetry(owner, transactionId)).toBeUndefined();
});
it.each([-24 * 3600000, 3600000])(
  "retains a block for out-of-window intents (%s)",
  (offset) => {
    saveReservationRetry({ ...intent(), startedAt: Date.now() + offset });
    expect(readReservationRetry(owner, transactionId)).toEqual({ kind: "history" });
    expect(sessionStorage.length).toBe(1);
  },
);
it("does not send corrupted, substituted or expanded stored requests", () => {
  saveReservationRetry(intent());
  const slot = sessionStorage.key(0)!;
  for (const raw of [
    "{",
    "x".repeat(2001),
    JSON.stringify({ ...intent(), owner: crypto.randomUUID() }),
    JSON.stringify({ ...intent(), body: { ...intent().body, termsAccepted: false } }),
    JSON.stringify({ ...intent(), token: "private" }),
  ]) {
    sessionStorage.setItem(slot, raw);
    expect(readReservationRetry(owner, transactionId)).toEqual({ kind: "history" });
  }
});
it("redacts session data without silently permitting another request", () => {
  const value = intent();
  saveReservationRetry(value);
  redactReservationRetries();
  expect(sessionStorage.getItem(sessionStorage.key(0)!)).not.toContain(value.key);
  expect(readReservationRetry(owner, transactionId)).toEqual({ kind: "history" });
});
it("fails closed when storage cannot be read, written or cleared", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("denied");
  });
  expect(readReservationRetry(owner, transactionId)).toEqual({ kind: "unavailable" });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  expect(() => saveReservationRetry(intent())).toThrow();
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
    throw new Error("denied");
  });
  expect(clearReservationRetry(owner, transactionId)).toBe(false);
});
