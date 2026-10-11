// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canRetryVehicleCreation,
  clearVehicleRetry,
  readVehicleRetry,
  redactVehicleRetries,
  saveVehicleRetry,
  type VehicleCreationIntent,
} from "../../lib/api/vehicle-creation-retry";

const owner = "f9000000-0000-4000-8000-000000000050";
const listingId = "f9000000-0000-4000-8000-000000000001";
const intent = (): VehicleCreationIntent => ({
  action: "inspect",
  owner,
  key: crypto.randomUUID(),
  startedAt: Date.now(),
  body: {
    vehicleListingId: listingId,
    preferredStartAt: "2099-10-01T09:30:00.000Z",
    notes: "Synthetic notes",
  },
});
beforeEach(() => sessionStorage.clear());
describe("vehicle creation retry recovery", () => {
  it("recovers the identical key and body and isolates accounts, operations and listings", () => {
    const value = intent();
    saveVehicleRetry(value);
    expect(readVehicleRetry(owner, listingId, "inspect")).toEqual({
      kind: "pending",
      intent: value,
    });
    expect(readVehicleRetry(crypto.randomUUID(), listingId, "inspect")).toBeUndefined();
    expect(readVehicleRetry(owner, listingId, "enquire")).toBeUndefined();
    expect(readVehicleRetry(owner, crypto.randomUUID(), "inspect")).toBeUndefined();
    expect(clearVehicleRetry(owner, listingId, "inspect")).toBe(true);
    expect(readVehicleRetry(owner, listingId, "inspect")).toBeUndefined();
  });
  it("keeps expired and future-dated intents blocked instead of silently creating a fresh key", () => {
    for (const startedAt of [Date.now() - 24 * 3600000, Date.now() + 3600000]) {
      const value = { ...intent(), startedAt };
      saveVehicleRetry(value);
      expect(canRetryVehicleCreation(value)).toBe(false);
      expect(readVehicleRetry(owner, listingId, "inspect")).toEqual({ kind: "history" });
      expect(sessionStorage.length).toBe(1);
    }
  });
  it("rejects malformed and cross-bound storage instead of sending its contents", () => {
    saveVehicleRetry(intent());
    const key = sessionStorage.key(0)!;
    for (const data of [
      "{",
      JSON.stringify({ ...intent(), owner: crypto.randomUUID() }),
      JSON.stringify({
        ...intent(),
        body: { vehicleListingId: listingId, preferredStartAt: "invalid" },
      }),
    ]) {
      sessionStorage.setItem(key, data);
      expect(readVehicleRetry(owner, listingId, "inspect")).toEqual({ kind: "history" });
    }
  });
  it("redacts notes on session invalidation while retaining the history boundary", () => {
    saveVehicleRetry(intent());
    redactVehicleRetries();
    expect(sessionStorage.getItem(sessionStorage.key(0)!)).not.toContain(
      "Synthetic notes",
    );
    expect(readVehicleRetry(owner, listingId, "inspect")).toEqual({ kind: "history" });
  });
  it("does not silently discard a request when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage disabled");
    });
    expect(readVehicleRetry(owner, listingId, "inspect")).toEqual({
      kind: "unavailable",
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota exceeded");
    });
    expect(() => saveVehicleRetry(intent())).toThrow("Quota exceeded");
  });
});
