// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  parseStaffThread,
  parseThreadMessages,
  threadMessagesQuery,
  threadPageParams,
  threadAtLeast,
  mergeThread,
  threadSnapshot,
  validateThreadChange,
  markThreadPending,
  readThreadPending,
  clearThreadPending,
  redactThreadChanges,
  forgetThreadDrafts,
  type SupportChange,
} from "@/lib/admin/work-support-detail";
import { supportRecord, bookingId as id } from "../fixtures/work-support";
import { threadMessage } from "../fixtures/work-support-detail";
import { setDraftIdentity, draftKey } from "@/lib/forms/drafts";
const owner = id(302),
  role = "ADMIN",
  raw = () => ({ ...supportRecord("complaints"), acknowledgedAt: null }),
  record = () => parseStaffThread(raw(), id(60000), "complaints", role),
  reply = (data: unknown) => ({ data });
beforeEach(() => {
  sessionStorage.clear();
  setDraftIdentity(`${owner}:${role}`);
});
afterEach(() => {
  vi.restoreAllMocks();
  setDraftIdentity(null);
  sessionStorage.clear();
});
describe("staff conversation", () => {
  it("checks requested identity, branch and strictly paged message history", () => {
    expect(() => parseStaffThread(raw(), id(60001), "complaints", role)).toThrow();
    expect(() =>
      parseStaffThread(raw(), id(60000), "complaints", "STAFF", id(102)),
    ).toThrow();
    const a = threadMessage(0);
    expect(
      parseThreadMessages({ items: [a], cursor: a.id, hasMore: false, pollAfterMs: 5000 })
        .items,
    ).toHaveLength(1);
    expect(() =>
      parseThreadMessages({
        items: [a, a],
        cursor: a.id,
        hasMore: false,
        pollAfterMs: 5000,
      }),
    ).toThrow();
    expect(() =>
      parseThreadMessages({ items: [], cursor: a.id, hasMore: true, pollAfterMs: 5000 }),
    ).toThrow();
    expect(threadMessagesQuery(new URLSearchParams("cursor=bad"), "/base").invalid).toBe(
      true,
    );
    const next = threadPageParams(new URLSearchParams(), a.id);
    expect(threadMessagesQuery(next, "/base").invalid).toBe(false);
    expect(threadPageParams(next, undefined, true).size).toBe(0);
  });
  it("validates exact reply scope, visibility and body without an invented version increment", () => {
    const before = record(),
      change: SupportChange = {
        kind: "reply",
        body: { message: "Reviewed internal text", visibility: "INTERNAL" },
      },
      receipt = {
        ...threadMessage(1),
        body: "Reviewed internal text",
        conversationId: before.id,
        conversationKind: before.kind,
      };
    expect(validateThreadChange(reply(receipt), change, before, role).receipt?.body).toBe(
      "Reviewed internal text",
    );
    for (const bad of [
      { ...receipt, conversationId: id(999) },
      { ...receipt, visibility: "CUSTOMER" },
      { ...receipt, body: "Different" },
    ])
      expect(() => validateThreadChange(reply(bad), change, before, role)).toThrow();
  });
  it("requires the precise status response message even beyond embedded history", () => {
    const before = record(),
      change: SupportChange = {
        kind: "status",
        expectedVersion: before.version,
        body: { status: "RESOLVED", resolution: "Exact public resolution" },
      },
      saved = {
        ...raw(),
        status: "RESOLVED",
        resolution: "Exact public resolution",
        version: before.version + 1,
        messageReceipt: {
          ...threadMessage(0),
          body: "Exact public resolution",
          conversationId: before.id,
          conversationKind: before.kind,
        },
        messages: [],
      };
    expect(validateThreadChange(reply(saved), change, before, role).record?.status).toBe(
      "RESOLVED",
    );
    expect(() =>
      validateThreadChange(
        reply({ ...saved, messageReceipt: null }),
        change,
        before,
        role,
      ),
    ).toThrow();
  });
  it("distinguishes an existing acknowledgement from adding the reviewed response", () => {
    const before = record(),
      change: SupportChange = {
        kind: "acknowledgement",
        body: { message: "Reviewed acknowledgement" },
      },
      saved = {
        ...raw(),
        acknowledgedAt: "2026-10-18T10:00:37.123Z",
        acknowledgedNow: false,
        messageReceipt: null,
      };
    expect(validateThreadChange(reply(saved), change, before, role).added).toBe(false);
    expect(() =>
      validateThreadChange(
        reply({ ...saved, acknowledgedNow: true }),
        change,
        before,
        role,
      ),
    ).toThrow();
  });
  it("keeps newer versions and independent immutable acknowledgement facts", () => {
    const before = record(),
      newer = { ...before, version: 1 },
      acked = { ...before, acknowledgedAt: "2026-10-18T10:00:37.123Z" };
    expect(mergeThread(newer, before).version).toBe(1);
    expect(threadAtLeast(before, acked)).toBe(false);
    const change: SupportChange = { kind: "reply", body: {} };
    expect(threadSnapshot(newer, change)).toBe(threadSnapshot(before, change));
  });
  it("persists only minimal actor-scoped locks and redacts without unlocking", () => {
    const marker = markThreadPending(owner, role, "complaints", id(60000), "reply", 0),
      entries = Object.entries(sessionStorage).filter(([key]) =>
        key.startsWith("aat:staff-conversation:v1:"),
      );
    expect(Object.keys(JSON.parse(entries[0][1])).sort()).toEqual([
      "kind",
      "token",
      "version",
    ]);
    expect(() =>
      markThreadPending(owner, role, "complaints", id(60000), "reply", 0),
    ).toThrow();
    expect(readThreadPending(owner, role, "enquiries", id(60000))).toBeUndefined();
    expect(() =>
      clearThreadPending(owner, role, "complaints", id(60000), id(9)),
    ).toThrow();
    clearThreadPending(owner, role, "complaints", id(60000), marker.token);
    markThreadPending(owner, role, "complaints", id(60000), "status", 0);
    redactThreadChanges();
    expect(readThreadPending(owner, role, "complaints", id(60000))).toBe("unknown");
  });
  it("clears only this conversation drafts and fails closed when storage is blocked", () => {
    const own = draftKey(
        `${owner}:${role}`,
        `/admin/support/complaints/${id(60000)}`,
        "reply",
      ),
      other = draftKey(
        `${owner}:${role}`,
        `/admin/support/complaints/${id(60001)}`,
        "reply",
      );
    for (const key of [own, other]) sessionStorage.setItem(key, "{}");
    forgetThreadDrafts(owner, role, "complaints", id(60000));
    expect(sessionStorage.getItem(own)).toBeNull();
    expect(sessionStorage.getItem(other)).toBe("{}");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(readThreadPending(owner, role, "complaints", id(60000))).toBe("unknown");
    expect(() =>
      markThreadPending(owner, role, "complaints", id(60000), "reply", 0),
    ).toThrow();
  });
  it("validates exact message anchors and clears them when changing history pages", () => {
    const anchor = "b4000000-0000-4000-8000-000000000001";
    const anchored = new URLSearchParams({ messageId: anchor });
    expect(threadMessagesQuery(anchored, "/base").path).toContain(`messageId=${anchor}`);
    expect(
      threadMessagesQuery(
        new URLSearchParams({ messageId: anchor, cursor: anchor }),
        "/base",
      ).invalid,
    ).toBe(true);
    expect(
      threadMessagesQuery(new URLSearchParams("messageId=../outside"), "/base").invalid,
    ).toBe(true);
    expect(threadPageParams(anchored, anchor).has("messageId")).toBe(false);
  });
});
