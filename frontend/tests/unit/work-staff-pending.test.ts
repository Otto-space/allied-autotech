// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  clearStaffPending,
  markStaffPending,
  readStaffPending,
  redactStaffChanges,
} from "@/lib/admin/work-staff-pending";
const owner = "d1000000-0000-4000-8000-000000000302",
  target = "d1000000-0000-4000-8000-000000240000";
beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  setDraftIdentity(`${owner}:ADMIN`);
});
it("keeps only a token and change area, isolates targets and blocks replacement or mismatched clearing", () => {
  const marker = markStaffPending(owner, "ADMIN", target, "account");
  expect(readStaffPending(owner, "ADMIN", target)).toEqual(marker);
  expect(readStaffPending(owner, "ADMIN", owner)).toBeUndefined();
  expect(readStaffPending(owner, "SUPER_ADMIN", target)).toBeUndefined();
  expect(
    Object.keys(
      JSON.parse(sessionStorage.getItem(`aat:staff-change:v1:${owner}:ADMIN:${target}`)!),
    ).sort(),
  ).toEqual(["area", "token"]);
  expect(() => markStaffPending(owner, "ADMIN", target, "capability")).toThrow();
  expect(() => clearStaffPending(owner, "ADMIN", target, owner)).toThrow();
  clearStaffPending(owner, "ADMIN", target, marker.token);
  expect(readStaffPending(owner, "ADMIN", target)).toBeUndefined();
});
it("redacts context and fails closed for unavailable storage, corrupt data and changed actors", () => {
  markStaffPending(owner, "ADMIN", target, "workforce");
  redactStaffChanges();
  expect(readStaffPending(owner, "ADMIN", target)).toBe("unknown");
  expect(sessionStorage.getItem(`aat:staff-change:v1:${owner}:ADMIN:${target}`)).toBe(
    "pending",
  );
  clearStaffPending(owner, "ADMIN", target);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  expect(() => markStaffPending(owner, "ADMIN", target, "account")).toThrow();
  vi.restoreAllMocks();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("blocked");
  });
  expect(readStaffPending(owner, "ADMIN", target)).toBe("unknown");
  setDraftIdentity("another:ADMIN");
  expect(() => clearStaffPending(owner, "ADMIN", target)).toThrow();
});
