// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import { invalidateSession } from "@/lib/api/client";
import { preferenceWriteBodySchema } from "@/lib/api/notification-schemas";
import {
  readPreferenceRecovery,
  savePreferenceRecovery,
  type PreferenceIntent,
} from "@/lib/notifications/preference-recovery";
const owner = "b3000000-0000-4000-8000-000000000020";
const slot = `aat:notification-write:v1:${owner}:preferences`;
const intent = (): PreferenceIntent => ({
  owner,
  role: "CUSTOMER",
  key: `preference-v1.${Date.now()}.b3000000-0000-4000-8000-000000000021`,
  body: { category: "MARKETING", channel: "EMAIL", enabled: true, expectedVersion: 0 },
});
beforeEach(() => {
  sessionStorage.clear();
  setDraftIdentity(`${owner}:CUSTOMER`);
});
afterEach(() => vi.restoreAllMocks());
it("retains exact request, original revision and role for each supported account", () => {
  for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const) {
    setDraftIdentity(`${owner}:${role}`);
    const value = { ...intent(), role };
    savePreferenceRecovery(value);
    expect(readPreferenceRecovery(owner)).toEqual({ kind: "pending", intent: value });
  }
});
it("retains uncertainty for legacy, corrupt, foreign and expired intents", () => {
  for (const raw of [
    "pending",
    "{",
    JSON.stringify({ ...intent(), owner: "b3000000-0000-4000-8000-000000000099" }),
    JSON.stringify({
      ...intent(),
      key: `preference-v1.${Date.now() - 86400001}.b3000000-0000-4000-8000-000000000021`,
    }),
  ]) {
    sessionStorage.setItem(slot, raw);
    expect(readPreferenceRecovery(owner)).toEqual({ kind: "history" });
  }
});
it("cannot save under a different role or absent account", () => {
  for (const id of [null, `${owner}:ADMIN`]) {
    setDraftIdentity(id);
    expect(() => savePreferenceRecovery(intent())).toThrow();
  }
  expect(sessionStorage.getItem(slot)).toBeNull();
});
it("session invalidation removes consent contents while preserving uncertainty", () => {
  savePreferenceRecovery(intent());
  invalidateSession();
  expect(sessionStorage.getItem(slot)).toBe("pending");
});
it("refuses submission when retained state cannot be verified", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
  expect(() => savePreferenceRecovery(intent())).toThrow();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Denied");
  });
  expect(readPreferenceRecovery(owner)).toEqual({ kind: "unavailable" });
});
it("requires an exact bounded revision and optional-message category", () => {
  for (const body of [
    { ...intent().body, expectedVersion: "0" },
    { ...intent().body, expectedVersion: -1 },
    { ...intent().body, expectedVersion: 2147483647 },
    { ...intent().body, category: "SECURITY" },
    { ...intent().body, userId: owner },
  ])
    expect(preferenceWriteBodySchema.safeParse(body).success).toBe(false);
});
