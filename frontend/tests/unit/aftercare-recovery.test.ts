// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import { invalidateSession } from "@/lib/api/client";
import {
  readAftercareRecovery,
  saveAftercareRecovery,
  type AftercareIntent,
} from "@/lib/orders/aftercare-recovery";
const owner = "d5000000-0000-4000-8000-000000000021",
  orderId = "d5000000-0000-4000-8000-000000000001";
const slot = `aat:aftercare-create:v1:${owner}:${orderId}`;
const intent = (): AftercareIntent => ({
  owner,
  orderId,
  operation: "returns",
  key: `aftercare-v1.${Date.now()}.d5000000-0000-4000-8000-000000000099`,
  body: { reason: "Original private request" },
});
beforeEach(() => {
  sessionStorage.clear();
  setDraftIdentity(`${owner}:CUSTOMER`);
});
afterEach(() => vi.restoreAllMocks());
it("retains normalized original request and order identity", () => {
  const value = intent();
  saveAftercareRecovery({ ...value, body: { reason: " Original private request " } });
  expect(readAftercareRecovery(owner, orderId)).toEqual({
    kind: "pending",
    intent: value,
  });
});
it("does not restore another actor, order, kind or expired request", () => {
  const value = intent();
  for (const v of [
    { ...value, owner: orderId },
    { ...value, orderId: owner },
    { ...value, operation: "aftercare" },
    { ...value, key: value.key.replace(/\.\d{13}\./, `.${Date.now() - 86400001}.`) },
  ]) {
    sessionStorage.setItem(slot, JSON.stringify(v));
    expect(readAftercareRecovery(owner, orderId)).toEqual({
      kind: "history",
    });
  }
});
it("cannot store a staff-visible payload or a different signed-in account", () => {
  expect(() =>
    saveAftercareRecovery({
      ...intent(),
      body: { reason: "Hello", visibility: "INTERNAL" },
    } as unknown as AftercareIntent),
  ).toThrow();
  setDraftIdentity(`${owner}:ADMIN`);
  expect(() => saveAftercareRecovery(intent())).toThrow();
  expect(sessionStorage.getItem(slot)).toBeNull();
});
it("preserves uncertainty for legacy and damaged retained state", () => {
  for (const raw of ["pending", "{", "x".repeat(20001)]) {
    sessionStorage.setItem(slot, raw);
    expect(readAftercareRecovery(owner, orderId)).toEqual({
      kind: "history",
    });
  }
});
it("session invalidation redacts the request contents but preserves uncertainty", () => {
  saveAftercareRecovery(intent());
  invalidateSession();
  expect(sessionStorage.getItem(slot)).toBe("pending");
});
it("fails closed if storage cannot persist or verify the original request", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
  expect(() => saveAftercareRecovery(intent())).toThrow();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Denied");
  });
  expect(readAftercareRecovery(owner, orderId)).toEqual({
    kind: "unavailable",
  });
});
