// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import {
  assertChannelTarget,
  careChannelLookupSchema,
  careChannelOutcomeSchema,
  careChannelSchema,
} from "@/lib/api/support-channel-schemas";
import {
  channelRecoveryOwner,
  clearChannelPending,
  newChannelOperationKey,
  readChannelPending,
  redactChannelPending,
  saveChannelPending,
} from "@/lib/support/channel-pending";

const id = "f1600000-0000-4000-8000-000000000001";
const other = "f1600000-0000-4000-8000-000000000002";
const channel = {
  id,
  target: { kind: "ENQUIRY" as const, id },
  branchId: other,
  state: "QUEUED" as const,
  version: 1,
  updatedAt: "2026-10-28T12:00:00Z",
  queuedSince: "2026-10-28T12:00:00Z",
  claimedAt: null,
  endedAt: null,
  latestPublicMessageId: null,
  assignedToYou: false,
  canClaim: false,
  canTransfer: false,
  canEnd: true,
  pollAfterMs: 5000 as const,
};
afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

it("binds opaque reminders to identity, role, kind and case without storing their identifiers", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const owner = await channelRecoveryOwner(id, "CUSTOMER", "enquiries", id);
  expect(owner).toMatch(/^[a-f0-9]{64}$/);
  const owners = await Promise.all([
    channelRecoveryOwner(other, "CUSTOMER", "enquiries", id),
    channelRecoveryOwner(id, "STAFF", "enquiries", id),
    channelRecoveryOwner(id, "CUSTOMER", "complaints", id),
    channelRecoveryOwner(id, "CUSTOMER", "enquiries", other),
  ]);
  expect(owners.every((value) => value !== owner)).toBe(true);
  const marker = { action: "request" as const, operationKey: newChannelOperationKey() };
  saveChannelPending(owner, marker);
  expect(readChannelPending(owner)).toEqual(marker);
  expect(JSON.stringify(sessionStorage)).not.toContain(id);
  expect(readChannelPending(owners[0])).toBeNull();
});
it("rejects private payloads instead of persisting them in a reminder", () => {
  const marker = {
    action: "transfer" as const,
    operationKey: newChannelOperationKey(),
    reason: "Private staff reason",
  };
  expect(() => saveChannelPending("a".repeat(64), marker)).toThrow();
  expect(sessionStorage.length).toBe(0);
});
it("does not silently discard a corrupt pending marker or overwrite it on read", () => {
  sessionStorage.setItem("aat:care-channel:v1:" + "a".repeat(64), "{broken");
  expect(() => readChannelPending("a".repeat(64))).toThrow();
  expect(sessionStorage.getItem("aat:care-channel:v1:" + "a".repeat(64))).toBe("{broken");
});
it("clears only its own reminder and identity redaction preserves unrelated storage", () => {
  saveChannelPending("a".repeat(64), {
    action: "end",
    operationKey: newChannelOperationKey(),
  });
  saveChannelPending("b".repeat(64), {
    action: "claim",
    operationKey: newChannelOperationKey(),
  });
  sessionStorage.setItem("unrelated", "keep");
  clearChannelPending("a".repeat(64));
  expect(readChannelPending("b".repeat(64))).toBeTruthy();
  redactChannelPending();
  expect(sessionStorage.getItem("unrelated")).toBe("keep");
  expect(sessionStorage.length).toBe(1);
});
it.each(["enquiries", "complaints"] as const)(
  "rejects another %s case before adopting an outcome",
  (kind) => {
    expect(() => assertChannelTarget(channel, kind, other)).toThrow();
  },
);
it("accepts the correct current case and requires an explicit public update anchor", () => {
  expect(assertChannelTarget(channel, "enquiries", id)).toEqual(channel);
  expect(
    careChannelLookupSchema.parse({
      channel: null,
      caseVersion: 0,
      latestPublicMessageId: null,
    }).channel,
  ).toBeNull();
  expect(() =>
    careChannelLookupSchema.parse({ channel: null, caseVersion: 0 }),
  ).toThrow();
});
it.each(["body", "customerEmail", "internalNote", "queuePosition", "waitMinutes"])(
  "rejects unexpected %s in the channel projection",
  (field) => {
    expect(() =>
      careChannelSchema.parse({ ...channel, [field]: "must not leak" }),
    ).toThrow();
  },
);
it("requires saved and cancelled recovery outcomes to carry the matching shape", () => {
  expect(
    careChannelOutcomeSchema.parse({ action: "request", state: "SAVED", channel }).state,
  ).toBe("SAVED");
  expect(
    careChannelOutcomeSchema.parse({ action: "claim", state: "CANCELLED", channel: null })
      .state,
  ).toBe("CANCELLED");
  expect(() =>
    careChannelOutcomeSchema.parse({ action: "request", state: "SAVED", channel: null }),
  ).toThrow();
  expect(() =>
    careChannelOutcomeSchema.parse({ action: "claim", state: "CANCELLED", channel }),
  ).toThrow();
});
