// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import { invalidateSession } from "@/lib/api/client";
import {
  readSupportReplyRecovery,
  saveSupportReplyRecovery,
  type SupportReplyIntent,
} from "@/lib/support/reply-recovery";
const owner = "d5000000-0000-4000-8000-000000000021",
  conversationId = "d5000000-0000-4000-8000-000000000001";
const slot = `aat:support-reply:v1:${owner}:enquiries:${conversationId}`;
const intent = (): SupportReplyIntent => ({
  owner,
  conversationId,
  kind: "enquiries",
  key: `support-reply-v1.${Date.now()}.d5000000-0000-4000-8000-000000000099`,
  body: { message: "Original private reply" },
});
beforeEach(() => {
  sessionStorage.clear();
  setDraftIdentity(`${owner}:CUSTOMER`);
});
afterEach(() => vi.restoreAllMocks());
it("retains normalized original reply and conversation identity", () => {
  const value = intent();
  saveSupportReplyRecovery({ ...value, body: { message: " Original private reply " } });
  expect(readSupportReplyRecovery(owner, "enquiries", conversationId)).toEqual({
    kind: "pending",
    intent: value,
  });
});
it("does not restore another actor, conversation, kind or expired request", () => {
  const value = intent();
  for (const v of [
    { ...value, owner: conversationId },
    { ...value, conversationId: owner },
    { ...value, kind: "complaints" },
    { ...value, key: value.key.replace(/\.\d{13}\./, `.${Date.now() - 86400001}.`) },
  ]) {
    sessionStorage.setItem(slot, JSON.stringify(v));
    expect(readSupportReplyRecovery(owner, "enquiries", conversationId)).toEqual({
      kind: "history",
    });
  }
});
it("cannot store a staff-visible payload or a different signed-in account", () => {
  expect(() =>
    saveSupportReplyRecovery({
      ...intent(),
      body: { message: "Hello", visibility: "INTERNAL" },
    } as unknown as SupportReplyIntent),
  ).toThrow();
  setDraftIdentity(`${owner}:ADMIN`);
  expect(() => saveSupportReplyRecovery(intent())).toThrow();
  expect(sessionStorage.getItem(slot)).toBeNull();
});
it("preserves uncertainty for legacy and damaged retained state", () => {
  for (const raw of ["pending", "{", "x".repeat(20001)]) {
    sessionStorage.setItem(slot, raw);
    expect(readSupportReplyRecovery(owner, "enquiries", conversationId)).toEqual({
      kind: "history",
    });
  }
});
it("session invalidation redacts the reply contents but preserves uncertainty", () => {
  saveSupportReplyRecovery(intent());
  invalidateSession();
  expect(sessionStorage.getItem(slot)).toBe("pending");
});
it("fails closed if storage cannot persist or verify the original request", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
  expect(() => saveSupportReplyRecovery(intent())).toThrow();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Denied");
  });
  expect(readSupportReplyRecovery(owner, "enquiries", conversationId)).toEqual({
    kind: "unavailable",
  });
});
