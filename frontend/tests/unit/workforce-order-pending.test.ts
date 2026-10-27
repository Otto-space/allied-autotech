// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  clearWorkforceOrderPending,
  markWorkforceOrderPending,
  readWorkforceOrderPending,
  redactWorkforceOrderPending,
} from "@/lib/admin/workforce-order-pending";
const owner = "b8000000-0000-4000-8000-000000000001",
  target = {
    id: "b8000000-0000-4000-8000-000000000020",
    action: "prepare" as const,
    version: 3,
  };
beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("crypto", webcrypto);
  sessionStorage.clear();
  setDraftIdentity(`${owner}:STAFF`);
});
it("stores only minimal metadata and rejects replacement or a mismatched receipt token", async () => {
  const marker = await markWorkforceOrderPending(owner, target, {
    body: "Private preparation note",
  });
  expect(readWorkforceOrderPending(owner)).toEqual(marker);
  expect(JSON.stringify(sessionStorage)).not.toContain("Private preparation note");
  expect(Object.keys(marker).sort()).toEqual([
    "action",
    "fingerprint",
    "id",
    "token",
    "version",
  ]);
  await expect(markWorkforceOrderPending(owner, target, {})).rejects.toThrow();
  expect(() => clearWorkforceOrderPending(owner, owner)).toThrow();
  clearWorkforceOrderPending(owner, marker.token);
  expect(readWorkforceOrderPending(owner)).toBeUndefined();
});
it("retains a redacted lock and refuses sending when storage or identity is unavailable", async () => {
  await markWorkforceOrderPending(owner, target, {});
  redactWorkforceOrderPending();
  expect(readWorkforceOrderPending(owner)).toBe("unknown");
  clearWorkforceOrderPending(owner);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  await expect(markWorkforceOrderPending(owner, target, {})).rejects.toThrow();
  setDraftIdentity("another:STAFF");
  await expect(markWorkforceOrderPending(owner, target, {})).rejects.toThrow();
  expect(() => clearWorkforceOrderPending(owner)).toThrow();
});
