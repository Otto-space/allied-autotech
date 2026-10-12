// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import { invalidateSession } from "@/lib/api/client";
import { normalizeSupportCreation } from "@/lib/api/support-schemas";
import {
  readSupportCreationRecovery,
  saveSupportCreationRecovery,
  type SupportCreationIntent,
} from "@/lib/support/creation-recovery";
const owner = "d5000000-0000-4000-8000-000000000021";
const slot = (kind: string) => `aat:support-create:v1:${owner}:${kind}`;
const intent = (): SupportCreationIntent => ({
  owner,
  kind: "enquiries",
  key: `support-create-v1.${Date.now()}.d5000000-0000-4000-8000-000000000099`,
  body: {
    type: "GENERAL",
    subject: "Original subject",
    message: "Original private message",
  },
});
beforeEach(() => {
  sessionStorage.clear();
  setDraftIdentity(`${owner}:CUSTOMER`);
});
afterEach(() => vi.restoreAllMocks());
it("retains normalized original contents independently by operation", () => {
  const first = intent();
  saveSupportCreationRecovery(first);
  const second: SupportCreationIntent = {
    ...first,
    kind: "complaints",
    body: { subject: "Complaint", description: "Details" },
  };
  saveSupportCreationRecovery(second);
  expect(readSupportCreationRecovery(owner, "enquiries")).toEqual({
    kind: "pending",
    intent: first,
  });
  expect(readSupportCreationRecovery(owner, "complaints")).toEqual({
    kind: "pending",
    intent: second,
  });
  expect(
    normalizeSupportCreation("enquiries", {
      ...first.body,
      subject: " Original subject ",
    }),
  ).toEqual(first.body);
});
it("keeps legacy, malformed, expired, future, foreign and wrong-kind states uncertain", () => {
  const value = intent();
  for (const raw of [
    "pending",
    "{",
    JSON.stringify({ ...value, owner: "d5000000-0000-4000-8000-000000000022" }),
    JSON.stringify({ ...value, kind: "complaints" }),
    ...[-86400001, 120000].map((offset) =>
      JSON.stringify({
        ...value,
        key: value.key.replace(/\.\d{13}\./, `.${Date.now() + offset}.`),
      }),
    ),
  ]) {
    sessionStorage.setItem(slot("enquiries"), raw);
    expect(readSupportCreationRecovery(owner, "enquiries")).toEqual({ kind: "history" });
  }
});
it("rejects private ownership fields, mixed sources and missing selected-source IDs", () => {
  for (const body of [
    { ...intent().body, customerId: owner },
    { ...intent().body, type: "BOOKING" },
  ])
    expect(() => normalizeSupportCreation("enquiries", body)).toThrow();
  expect(() =>
    normalizeSupportCreation("complaints", {
      subject: "Test",
      description: "Details",
      bookingId: owner,
      orderId: owner,
    }),
  ).toThrow();
});
it("cannot save for a different account or role", () => {
  for (const account of [
    null,
    `${owner}:ADMIN`,
    "d5000000-0000-4000-8000-000000000022:CUSTOMER",
  ]) {
    setDraftIdentity(account);
    expect(() => saveSupportCreationRecovery(intent())).toThrow();
  }
  expect(sessionStorage.getItem(slot("enquiries"))).toBeNull();
});
it("redacts retained private text on session invalidation while preserving uncertainty", () => {
  saveSupportCreationRecovery(intent());
  sessionStorage.setItem(`aat:support-reply:v1:${owner}:enquiries:test`, "pending");
  invalidateSession();
  expect(sessionStorage.getItem(slot("enquiries"))).toBe("pending");
  expect(sessionStorage.getItem(`aat:support-reply:v1:${owner}:enquiries:test`)).toBe(
    "pending",
  );
});
it("fails closed when storage cannot retain and verify the original request", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
  expect(() => saveSupportCreationRecovery(intent())).toThrow();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Denied");
  });
  expect(readSupportCreationRecovery(owner, "enquiries")).toEqual({
    kind: "unavailable",
  });
});
