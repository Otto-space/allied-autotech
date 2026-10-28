// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  readWorkforceBookingPending,
  markWorkforceBookingPending,
  clearWorkforceBookingPending,
  redactWorkforceBookingPending,
} from "@/lib/admin/workforce-booking-pending";
const owner = "b8000000-0000-4000-8000-000000000001",
  booking = "b8000000-0000-4000-8000-000000000020";
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  sessionStorage.clear();
  setDraftIdentity(`${owner}:STAFF`);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setDraftIdentity(null);
  sessionStorage.clear();
});
it("retains only a minimal reference, prevents replacement and binds clearing to its token", () => {
  const marker = markWorkforceBookingPending(owner, booking, 2);
  expect(readWorkforceBookingPending(owner)).toEqual(marker);
  expect(Object.keys(marker).sort()).toEqual(["id", "token", "version"]);
  expect(() => markWorkforceBookingPending(owner, booking, 2)).toThrow();
  expect(() => clearWorkforceBookingPending(owner, owner)).toThrow();
  clearWorkforceBookingPending(owner, marker.token);
  expect(readWorkforceBookingPending(owner)).toBeUndefined();
});
it("keeps a redacted uncertain block and refuses writes from a changed identity", () => {
  const marker = markWorkforceBookingPending(owner, booking, 0);
  redactWorkforceBookingPending();
  expect(readWorkforceBookingPending(owner)).toBe("unknown");
  expect(JSON.stringify(sessionStorage)).not.toContain(booking);
  expect(() => clearWorkforceBookingPending(owner, marker.token)).toThrow();
  setDraftIdentity("another:STAFF");
  expect(() => clearWorkforceBookingPending(owner)).toThrow();
  expect(() => markWorkforceBookingPending(owner, booking, 0)).toThrow();
});
it("fails closed when recovery storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("Synthetic quota");
  });
  expect(() => markWorkforceBookingPending(owner, booking, 0)).toThrow();
});
