// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  clearJobPending,
  markJobPending,
  readJobPending,
  redactJobRetries,
} from "@/lib/admin/work-job-pending";
const owner = "d1000000-0000-4000-8000-000000000302",
  target = { id: "d1000000-0000-4000-8000-000000400000", source: "outbox" as const };
beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  setDraftIdentity(`${owner}:ADMIN`);
});
it("persists only actor-bound job identity and token and forbids replacement", () => {
  const saved = markJobPending(owner, "ADMIN", target);
  expect(readJobPending(owner, "ADMIN")).toEqual(saved);
  expect(Object.keys(saved).sort()).toEqual(["id", "source", "token"]);
  expect(() => markJobPending(owner, "ADMIN", target)).toThrow();
  expect(() => clearJobPending(owner, "ADMIN", owner)).toThrow();
  clearJobPending(owner, "ADMIN", saved.token);
  expect(readJobPending(owner, "ADMIN")).toBeUndefined();
});
it("redacts references while keeping a lock and fails closed on storage or identity loss", () => {
  markJobPending(owner, "ADMIN", target);
  redactJobRetries();
  expect(readJobPending(owner, "ADMIN")).toBe("unknown");
  clearJobPending(owner, "ADMIN");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  expect(() => markJobPending(owner, "ADMIN", target)).toThrow();
  setDraftIdentity("other:ADMIN");
  expect(() => clearJobPending(owner, "ADMIN")).toThrow();
});
