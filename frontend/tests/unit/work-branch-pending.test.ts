// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  clearBranchPending,
  markBranchPending,
  readBranchPending,
  redactBranchChanges,
} from "@/lib/admin/work-branch-pending";
const owner = "d1000000-0000-4000-8000-000000000302",
  target = "d1000000-0000-4000-8000-000000290000";
beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  setDraftIdentity(`${owner}:ADMIN`);
});
it("keeps only an actor-bound operation reference and prevents duplicate or unrelated clearing", () => {
  const marker = markBranchPending(owner, "ADMIN", { kind: "update", target });
  expect(readBranchPending(owner, "ADMIN")).toEqual(marker);
  expect(Object.keys(marker).sort()).toEqual(["kind", "target", "token"]);
  expect(readBranchPending(owner, "SUPER_ADMIN")).toBeUndefined();
  expect(() =>
    markBranchPending(owner, "ADMIN", { kind: "create", code: "BR-NEW" }),
  ).toThrow();
  expect(() => clearBranchPending(owner, "ADMIN", owner)).toThrow();
  clearBranchPending(owner, "ADMIN", marker.token);
  const created = markBranchPending(owner, "ADMIN", { kind: "create", code: "br-new" });
  expect(created).toMatchObject({ kind: "create", code: "BR-NEW" });
  expect(Object.keys(created).sort()).toEqual(["code", "kind", "token"]);
});
it("redacts references on session changes and fails closed for corrupt or unavailable storage", () => {
  markBranchPending(owner, "ADMIN", { kind: "update", target });
  redactBranchChanges();
  expect(readBranchPending(owner, "ADMIN")).toBe("unknown");
  expect(sessionStorage.getItem(`aat:branch-change:v1:${owner}:ADMIN`)).toBe("pending");
  clearBranchPending(owner, "ADMIN");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  expect(() =>
    markBranchPending(owner, "ADMIN", { kind: "create", code: "BR-NEW" }),
  ).toThrow();
  vi.restoreAllMocks();
  setDraftIdentity("another:ADMIN");
  expect(() => clearBranchPending(owner, "ADMIN")).toThrow();
});
