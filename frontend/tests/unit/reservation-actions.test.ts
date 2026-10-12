// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { apiRequest, ApiError } from "@/lib/api/client";
import { confirmReservation } from "@/lib/api/reservation-actions";
import {
  parseReservationTerms,
  readReservationRetry,
  saveReservationRetry,
  type TermsDocument,
} from "@/lib/api/reservation-terms";
import { detailRecord, purchaseId } from "../fixtures/customer-purchase-detail";
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: vi.fn(),
}));
const owner = purchaseId(302);
const document: TermsDocument = {
  version: purchaseId(900),
  revision: 1,
  title: "Synthetic QA agreement",
  body: "Synthetic test text only.",
  contentSha256: "a".repeat(64),
  effectiveAt: "2026-01-01T00:00:00Z",
};
const record = {
  ...detailRecord(),
  status: "NEGOTIATING" as const,
  termsVersion: null,
  termsAcceptedAt: null,
  reservationExpiresAt: null,
};
let terms = {
  current: document as TermsDocument | null,
  accepted: null,
  legacyAcceptance: false,
};
let latest = { ...record };
let actor = owner;
let response: unknown;
let failure: unknown;
const writes: { body: unknown; key?: string }[] = [];
const run = (
  retry?: Extract<
    NonNullable<ReturnType<typeof readReservationRetry>>,
    { kind: "pending" }
  >["intent"],
) =>
  confirmReservation({
    owner,
    record,
    document,
    retry,
    signal: new AbortController().signal,
  });
beforeEach(() => {
  sessionStorage.clear();
  writes.length = 0;
  terms = { current: document, accepted: null, legacyAcceptance: false };
  latest = { ...record };
  actor = owner;
  failure = undefined;
  response = {
    transaction: {
      ...record,
      status: "RESERVED",
      version: record.version + 1,
      termsVersion: document.version,
      termsAcceptedAt: new Date().toISOString(),
    },
    replayed: false,
  };
  vi.mocked(apiRequest).mockImplementation(async (path, options) => {
    let data: unknown;
    if (path === "/auth/session") data = { user: { id: actor, role: "CUSTOMER" } };
    else if (path.endsWith("/reservation-terms")) data = terms;
    else if (path.endsWith("/reserve")) {
      expect(options?.csrf).toBe(true);
      expect(readReservationRetry(owner, record.id)?.kind).toBe("pending");
      writes.push({ body: options?.body, key: options?.idempotencyKey });
      if (failure) throw failure;
      data = response;
    } else data = latest;
    return { success: true, data, message: "test", meta: { requestId: "qa" } } as Awaited<
      ReturnType<typeof apiRequest>
    >;
  });
});
it("checks identity and fresh agreement before sending one explicit, recoverable acceptance", async () => {
  await expect(run()).resolves.toMatchObject({ replayed: false });
  expect(writes).toEqual([
    {
      key: expect.any(String),
      body: {
        expectedVersion: record.version,
        termsVersion: document.version,
        termsAccepted: true,
      },
    },
  ]);
  expect(readReservationRetry(owner, record.id)).toBeUndefined();
});
it.each(["withdrawn", "superseded", "body", "price", "version", "identity"])(
  "sends nothing after %s changes",
  async (change) => {
    if (change === "withdrawn") terms.current = null;
    if (change === "superseded")
      terms.current = { ...document, version: purchaseId(901) };
    if (change === "body") terms.current = { ...document, body: "Different text" };
    if (change === "price") latest.agreedPriceKobo = "1";
    if (change === "version") latest.version++;
    if (change === "identity") actor = purchaseId(999);
    await expect(run()).rejects.toThrow();
    expect(writes).toHaveLength(0);
  },
);
it("replays the original key and body after response loss and withdrawal", async () => {
  failure = new Error("Network lost");
  await expect(run()).rejects.toThrow();
  const stored = readReservationRetry(owner, record.id);
  expect(stored?.kind).toBe("pending");
  if (stored?.kind !== "pending") throw new Error("Missing recovery");
  terms.current = null;
  failure = undefined;
  await run(stored.intent);
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
  expect(readReservationRetry(owner, record.id)).toBeUndefined();
});
it("keeps a rejected replay blocked, but releases a definitively rejected first request", async () => {
  failure = new ApiError(409, { error: { code: "CONFLICT" } });
  await expect(run()).rejects.toThrow();
  expect(readReservationRetry(owner, record.id)).toBeUndefined();
  failure = new Error("lost");
  await expect(run()).rejects.toThrow();
  const stored = readReservationRetry(owner, record.id);
  if (stored?.kind !== "pending") throw new Error("Missing recovery");
  failure = new ApiError(409, { error: { code: "CONFLICT" } });
  await expect(run(stored.intent)).rejects.toThrow();
  expect(readReservationRetry(owner, record.id)?.kind).toBe("pending");
});
it("blocks fresh requests when a previous outcome is unresolved or storage is full", async () => {
  failure = new Error("lost");
  await expect(run()).rejects.toThrow();
  await expect(run()).rejects.toThrow();
  expect(writes).toHaveLength(1);
  sessionStorage.clear();
  writes.length = 0;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("full");
  });
  await expect(run()).rejects.toThrow();
  expect(writes).toHaveLength(0);
});
it("does not replay after receipt retention or trust a substituted response", async () => {
  response = { transaction: { ...record, id: purchaseId(999) }, replayed: false };
  await expect(run()).rejects.toThrow();
  const stored = readReservationRetry(owner, record.id);
  if (stored?.kind !== "pending") throw new Error("Missing recovery");
  saveReservationRetry({ ...stored.intent, startedAt: Date.now() - 24 * 3600000 });
  await expect(run(stored.intent)).rejects.toThrow();
  expect(writes).toHaveLength(1);
});
it("rejects malformed agreement documents without inventing accepted text", () => {
  expect(() =>
    parseReservationTerms({
      ...terms,
      current: { ...document, contentSha256: "invalid" },
    }),
  ).toThrow();
  expect(
    parseReservationTerms({ current: null, accepted: null, legacyAcceptance: true })
      .accepted,
  ).toBeNull();
});
