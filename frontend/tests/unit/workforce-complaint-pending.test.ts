// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  clearWorkforceComplaintPending,
  markWorkforceComplaintPending,
  readWorkforceComplaintPending,
  redactWorkforceComplaintPending,
} from "@/lib/admin/workforce-complaint-pending";
const owner = "b8000000-0000-4000-8000-000000000001",
  target = {
    id: "b8000000-0000-4000-8000-000000000020",
    action: "reply" as const,
    version: 3,
  };
beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("crypto", webcrypto);
  sessionStorage.clear();
  setDraftIdentity(`${owner}:STAFF`);
});
it("stores only minimal metadata and rejects replacement or a mismatched receipt token", async () => {
  const marker = await markWorkforceComplaintPending(owner, target, {
    body: "Private customer reply",
  });
  expect(readWorkforceComplaintPending(owner)).toEqual(marker);
  expect(JSON.stringify(sessionStorage)).not.toContain("Private customer reply");
  expect(Object.keys(marker).sort()).toEqual([
    "action",
    "fingerprint",
    "id",
    "token",
    "version",
  ]);
  await expect(markWorkforceComplaintPending(owner, target, {})).rejects.toThrow();
  expect(() => clearWorkforceComplaintPending(owner, owner)).toThrow();
  clearWorkforceComplaintPending(owner, marker.token);
  expect(readWorkforceComplaintPending(owner)).toBeUndefined();
});
it("retains a redacted lock and refuses sending when storage or identity is unavailable", async () => {
  await markWorkforceComplaintPending(owner, target, {});
  redactWorkforceComplaintPending();
  expect(readWorkforceComplaintPending(owner)).toBe("unknown");
  clearWorkforceComplaintPending(owner);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  await expect(markWorkforceComplaintPending(owner, target, {})).rejects.toThrow();
  setDraftIdentity("another:STAFF");
  await expect(markWorkforceComplaintPending(owner, target, {})).rejects.toThrow();
  expect(() => clearWorkforceComplaintPending(owner)).toThrow();
});
it("shares the pending block between assignments and replies without storing the internal reason", async () => {
  const marker = await markWorkforceComplaintPending(
    owner,
    { ...target, action: "assignment" },
    { staffId: owner, reason: "Private internal assignment reason" },
  );
  expect(readWorkforceComplaintPending(owner)).toEqual(marker);
  expect(JSON.stringify(sessionStorage)).not.toContain(
    "Private internal assignment reason",
  );
  await expect(
    markWorkforceComplaintPending(owner, target, { body: "reply" }),
  ).rejects.toThrow();
  clearWorkforceComplaintPending(owner, marker.token);
  expect(readWorkforceComplaintPending(owner)).toBeUndefined();
});
