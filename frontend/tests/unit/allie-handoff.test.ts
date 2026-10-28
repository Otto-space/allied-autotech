// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import {
  handoffBody,
  handoffDraftSchema,
  handoffHref,
  handoffRecoverySchema,
  parseHandoffPreview,
  parseHandoffSaved,
  type HandoffDraft,
} from "@/lib/learning/handoff";
import {
  newHandoffKey,
  saveHandoffPending,
  readHandoffPending,
  clearHandoffPending,
  redactHandoffPending,
} from "@/lib/learning/handoff-pending";
import type { AllieConversation } from "@/lib/learning/conversation";

const id = (n: number) => `c1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const draft = (): HandoffDraft => ({
  target: {
    kind: "NEW_ENQUIRY",
    subject: "A question about my vehicle",
    branchId: id(1),
  },
  summary: "My editable question, kept away from the model.",
});
const conversation = (): AllieConversation => ({
  id: id(2),
  version: 3,
  audience: "customer",
  expiresAt: new Date(Date.now() + 600000).toISOString(),
  historyReset: false,
  pending: null,
  messages: [
    {
      operationId: id(3),
      question: "A selected customer question",
      answer: {
        kind: "answer",
        answer: "Synthetic AI guidance",
        steps: ["Check evidence."],
        caveat: "No confirmed fitment.",
        sourceIds: [],
        actionIds: [],
        sources: [],
        actions: [],
      },
    },
  ],
});
const preview = (input = draft(), context: AllieConversation | null = null) => ({
  target: {
    kind: "NEW_ENQUIRY",
    id: null,
    branchId: id(1),
    branchName: "Test branch",
    subject: "A question about my vehicle",
    version: null,
  },
  body: handoffBody(input, context),
  audience: "CUSTOMER_CARE",
  mode: "QUEUED",
  excerptCount: input.excerpts?.selections.length ?? 0,
  review: {
    token: "a".repeat(64),
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  },
  recoveryExpiresAt: new Date(Date.now() + 900000).toISOString(),
});
const receipt = () => ({
  reference: {
    kind: "ENQUIRY",
    id: id(4),
    branchId: id(1),
    messageId: null,
    createdNew: true,
  },
  replayed: false,
  state: "SAVED",
  mode: "QUEUED",
});
afterEach(() => sessionStorage.clear());
it("binds the exact editable summary and destination; it never silently attaches a conversation", () => {
  expect(parseHandoffPreview(preview(), draft(), conversation()).body).not.toContain(
    "Synthetic AI guidance",
  );
  for (const changed of [
    { ...preview(), body: preview().body + "\nUnselected private transcript" },
    { ...preview(), target: { ...preview().target, branchId: id(9) } },
    { ...preview(), target: { ...preview().target, subject: "Another issue" } },
    { ...preview(), mode: "LIVE" },
    { ...preview(), excerptCount: 1 },
    { ...preview(), internalNote: "Leaked note" },
  ])
    expect(() => parseHandoffPreview(changed, draft(), null)).toThrow();
});
it("exports only selected message parts, with explicit AI attribution", () => {
  const context = conversation(),
    input: HandoffDraft = {
      ...draft(),
      excerpts: {
        conversationId: context.id,
        expectedVersion: context.version,
        selections: [{ operationId: id(3), part: "ANSWER" }],
      },
    };
  const body = parseHandoffPreview(preview(input, context), input, context).body;
  expect(body).toContain("AI-generated guidance; may be wrong");
  expect(body).toContain(
    "Synthetic AI guidance\n1. Check evidence.\nNo confirmed fitment.",
  );
  expect(body).not.toContain(context.messages[0].question);
  input.excerpts!.selections[0].part = "QUESTION";
  expect(handoffBody(input, context)).toContain(context.messages[0].question);
  expect(handoffBody(input, context)).not.toContain("Synthetic AI guidance");
});
it("rejects expired, reset, different-session/audience and changed-version context", () => {
  const context = conversation(),
    input: HandoffDraft = {
      ...draft(),
      excerpts: {
        conversationId: context.id,
        expectedVersion: context.version,
        selections: [{ operationId: id(3), part: "QUESTION" }],
      },
    };
  for (const changed of [
    null,
    { ...context, audience: "work" as const },
    { ...context, audience: "public" as const },
    { ...context, id: id(9) },
    { ...context, version: 4 },
    { ...context, historyReset: true },
    { ...context, messages: [] },
    { ...context, expiresAt: new Date(Date.now() - 1).toISOString() },
  ])
    expect(() => handoffBody(input, changed)).toThrow();
});
it("requires modern server recovery and a current review instead of falling back to browser payload storage", () => {
  const noRecovery = { ...preview(), recoveryExpiresAt: undefined };
  expect(() => parseHandoffPreview(noRecovery, draft(), null)).toThrow();
  expect(() =>
    parseHandoffPreview(
      {
        ...preview(),
        review: {
          ...preview().review,
          expiresAt: new Date(Date.now() - 1).toISOString(),
        },
      },
      draft(),
      null,
    ),
  ).toThrow();
});
it("binds existing-case id/version and saved receipts, constructing only canonical support links", () => {
  const input: HandoffDraft = {
    ...draft(),
    target: { kind: "COMPLAINT", id: id(5), expectedVersion: 4 },
  };
  const value = {
    ...preview(),
    target: {
      ...preview().target,
      kind: "COMPLAINT",
      id: id(5),
      subject: "Existing complaint",
      version: 4,
    },
  };
  const reviewed = parseHandoffPreview(value, input, null);
  const saved = {
    ...receipt(),
    reference: {
      ...receipt().reference,
      kind: "COMPLAINT",
      id: id(5),
      messageId: id(6),
      createdNew: false,
    },
  };
  expect(handoffHref(parseHandoffSaved(saved, reviewed))).toBe(
    `/dashboard/support/complaints/${id(5)}`,
  );
  expect(() =>
    parseHandoffSaved(
      { ...saved, reference: { ...saved.reference, id: id(7) } },
      reviewed,
    ),
  ).toThrow();
  expect(() =>
    parseHandoffSaved(
      { ...saved, reference: { ...saved.reference, branchId: id(7) } },
      reviewed,
    ),
  ).toThrow();
  expect(() =>
    parseHandoffPreview(
      { ...value, target: { ...value.target, version: 5 } },
      input,
      null,
    ),
  ).toThrow();
  expect(() =>
    parseHandoffSaved({
      ...receipt(),
      reference: { ...receipt().reference, id: "javascript:alert(1)" },
    }),
  ).toThrow();
});
it("strict contracts keep identity, forged transcripts, audience switches and duplicate selections out", () => {
  for (const value of [
    { ...draft(), customerId: id(9) },
    { ...draft(), transcript: "Forged" },
    { ...draft(), audience: "INTERNAL" },
    { ...draft(), summary: "x".repeat(2001) },
    {
      ...draft(),
      excerpts: {
        conversationId: id(2),
        expectedVersion: 3,
        selections: [
          { operationId: id(3), part: "QUESTION" },
          { operationId: id(3), part: "QUESTION" },
        ],
      },
    },
  ])
    expect(handoffDraftSchema.safeParse(value).success).toBe(false);
  expect(
    handoffRecoverySchema.safeParse({
      state: "NEEDS_REVIEW",
      draft: draft(),
      preview: null,
      expiresAt: new Date().toISOString(),
      excerptsCleared: true,
    }).success,
  ).toBe(true);
  expect(
    handoffRecoverySchema.safeParse({ ...receipt(), transcript: "Leaked" }).success,
  ).toBe(false);
});
it("keeps only an owner-scoped non-bearer operation ID in session storage", () => {
  const owner = "a".repeat(64),
    other = "b".repeat(64),
    key = newHandoffKey();
  saveHandoffPending(owner, key);
  expect(readHandoffPending(owner)).toBe(key);
  expect(readHandoffPending(other)).toBeNull();
  expect(JSON.parse(sessionStorage.getItem(`aat:handoff:v1:${owner}`)!)).toEqual({
    operationKey: key,
  });
  expect(JSON.stringify(sessionStorage)).not.toContain(draft().summary);
  clearHandoffPending(owner);
  expect(readHandoffPending(owner)).toBeNull();
});
it("redacts only this feature's recovery markers on identity changes and fails closed on malformed markers", () => {
  sessionStorage.setItem("unrelated", "Preserve this preference");
  saveHandoffPending("a".repeat(64), newHandoffKey());
  saveHandoffPending("b".repeat(64), newHandoffKey());
  redactHandoffPending();
  expect(sessionStorage.getItem("unrelated")).toBe("Preserve this preference");
  expect(sessionStorage.length).toBe(1);
  sessionStorage.setItem(
    `aat:handoff:v1:${"a".repeat(64)}`,
    JSON.stringify({ operationKey: newHandoffKey(), body: "Must not be accepted" }),
  );
  expect(() => readHandoffPending("a".repeat(64))).toThrow();
});
