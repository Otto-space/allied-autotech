// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  clearInvitationPending,
  markInvitationPending,
  readInvitationPending,
  redactInvitationChanges,
} from "@/lib/admin/work-invitation-pending";
const owner = "d1000000-0000-4000-8000-000000000302",
  target = "d1000000-0000-4000-8000-000000240000";
beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  setDraftIdentity(`${owner}:ADMIN`);
});
it("retains minimal recovery context across reload and blocks replay or clearing another request", () => {
  const marker = markInvitationPending(owner, "ADMIN", { action: "promotion", target });
  expect(readInvitationPending(owner, "ADMIN")).toEqual(marker);
  expect(Object.keys(marker).sort()).toEqual(["action", "target", "token"]);
  expect(readInvitationPending(owner, "SUPER_ADMIN")).toBeUndefined();
  expect(() =>
    markInvitationPending(owner, "ADMIN", { action: "invitation", target }),
  ).toThrow();
  expect(() => clearInvitationPending(owner, "ADMIN", owner)).toThrow();
  clearInvitationPending(owner, "ADMIN", marker.token);
  expect(readInvitationPending(owner, "ADMIN")).toBeUndefined();
});
it("redacts target context on session changes and refuses unavailable storage or a changed actor", () => {
  markInvitationPending(owner, "ADMIN", { action: "revocation", target });
  redactInvitationChanges();
  expect(readInvitationPending(owner, "ADMIN")).toBe("unknown");
  expect(sessionStorage.getItem(`aat:invitation-change:v1:${owner}:ADMIN`)).toBe(
    "pending",
  );
  clearInvitationPending(owner, "ADMIN");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  expect(() =>
    markInvitationPending(owner, "ADMIN", { action: "invitation", target }),
  ).toThrow();
  vi.restoreAllMocks();
  setDraftIdentity("another:ADMIN");
  expect(() => clearInvitationPending(owner, "ADMIN")).toThrow();
});
