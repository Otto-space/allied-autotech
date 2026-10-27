// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aftercareFixtureData, aftercareId } from "../fixtures/workforce-aftercare-data";
import {
  parseWorkforceAftercare,
  parseWorkforceAftercarePage,
  parseAftercareDecisionReceipt,
  workforceAftercareQuery,
  aftercarePageParams,
} from "../../lib/admin/workforce-aftercare";
import {
  readAftercarePending,
  markAftercarePending,
  clearAftercarePending,
  redactAftercarePending,
} from "../../lib/admin/workforce-aftercare-pending";
import { setDraftIdentity } from "../../lib/forms/drafts";
const detail = () => {
  const f = aftercareFixtureData();
  return { ...f.record, access: f.access, generatedAt: new Date().toISOString() };
};
describe("scoped financial aftercare contracts", () => {
  it("requires the paired finance scope and grant for both page and record", () => {
    const value = detail();
    expect(parseWorkforceAftercare(value, value.id).id).toBe(value.id);
    for (const access of [
      { ...value.access, permissions: [] },
      { ...value.access, independentCapabilities: [] },
      { ...value.access, capabilityScopes: [] },
      { ...value.access, managed: false },
    ])
      expect(() => parseWorkforceAftercare({ ...value, access }, value.id)).toThrow();
    const foreign = {
      ...value,
      order: {
        ...value.order,
        branchId: aftercareId(98),
        branch: { id: aftercareId(98), name: "Foreign synthetic" },
      },
    };
    expect(() => parseWorkforceAftercare(foreign, value.id)).toThrow();
    expect(() =>
      parseWorkforceAftercarePage({
        items: [foreign],
        access: value.access,
        generatedAt: value.generatedAt,
      }),
    ).toThrow();
  });
  it("rejects mismatched identities, duplicate/invalid lines and falsely ready evidence", () => {
    const value = detail();
    for (const changed of [
      { ...value, orderId: aftercareId(99) },
      { ...value, requestedItems: [{ ...value.requestedItems![0], quantity: 4 }] },
      { ...value, requestedItems: [value.requestedItems![0], value.requestedItems![0]] },
      { ...value, policy: null },
      { ...value, requestedItems: null },
    ])
      expect(() => parseWorkforceAftercare(changed, value.id)).toThrow();
    expect(() => parseWorkforceAftercare(value, aftercareId(99))).toThrow();
    expect(
      parseWorkforceAftercare(
        { ...value, policy: null, requestedItems: null, reviewEvidenceReady: false },
        value.id,
      ).policy,
    ).toBeNull();
  });
  it("validates scoped list identity and cursor boundaries", () => {
    const value = detail(),
      page = { items: [value], access: value.access, generatedAt: value.generatedAt };
    expect(parseWorkforceAftercarePage(page).items).toHaveLength(1);
    expect(() =>
      parseWorkforceAftercarePage({ ...page, items: [value, value] }),
    ).toThrow();
    expect(() =>
      parseWorkforceAftercarePage({ ...page, nextCursor: value.id }),
    ).toThrow();
  });
  it("binds receipt to current request, order, branch, actor, note, stage and exact amount", () => {
    const value = detail(),
      before = parseWorkforceAftercare(value, value.id),
      input = {
        stage: "APPROVED" as const,
        note: "Synthetic reviewed customer-visible fee basis",
        approvedFeeKobo: "000",
        expectedStatus: "INSPECTED" as const,
        expectedRevision: value.reviewRevision,
      };
    const receipt = {
      id: value.id,
      orderId: value.orderId,
      branchId: value.order.branchId,
      status: "APPROVED",
      reviewNote: input.note,
      approvedFeeKobo: "0",
      reviewedAt: value.generatedAt,
      performedByUserId: value.access.userId,
    };
    expect(
      parseAftercareDecisionReceipt(receipt, before, value.access.userId, input).status,
    ).toBe("APPROVED");
    for (const changed of [
      { ...receipt, id: aftercareId(99) },
      { ...receipt, orderId: aftercareId(99) },
      { ...receipt, branchId: aftercareId(99) },
      { ...receipt, performedByUserId: aftercareId(99) },
      { ...receipt, status: "REJECTED" },
      { ...receipt, reviewNote: "Unexpected private text" },
      { ...receipt, approvedFeeKobo: "1" },
    ])
      expect(() =>
        parseAftercareDecisionReceipt(changed, before, value.access.userId, input),
      ).toThrow();
  });
  it("preserves bounded URL filtering and excludes client trails from requests", () => {
    const q = workforceAftercareQuery(
      new URLSearchParams({
        q: "  reference %_ ",
        status: "INSPECTED",
        kind: "RETURN",
        cursor: aftercareId(8),
        _trail: "start",
      }),
    );
    expect(q.invalid).toBe(false);
    expect(q.path).not.toContain("_trail");
    expect(q.path).toContain("limit=25");
    const next = aftercarePageParams(q.params, aftercareId(9));
    expect(next.get("_trail")).toBe(`start,${aftercareId(8)}`);
    expect(aftercarePageParams(next, undefined, true).get("cursor")).toBe(aftercareId(8));
    for (const raw of [
      "status=UNKNOWN",
      "kind=UNKNOWN",
      "q=x&q=y",
      "cursor=invalid",
      `cursor=${aftercareId(8)}&_trail=start,${aftercareId(8)}`,
      "q=%00",
      "debug=true",
    ])
      expect(workforceAftercareQuery(new URLSearchParams(raw)).path).toBeNull();
  });
});
describe("minimal financial decision recovery", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", webcrypto);
    sessionStorage.clear();
    setDraftIdentity(`${aftercareId(1)}:STAFF`);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
    setDraftIdentity(null);
  });
  it("preserves one pending request without storing decision text or replacing it", () => {
    const marker = markAftercarePending(aftercareId(1), aftercareId(10));
    expect(readAftercarePending(aftercareId(1))).toEqual(marker);
    expect(() => markAftercarePending(aftercareId(1), aftercareId(11))).toThrow();
    expect(() => clearAftercarePending(aftercareId(1), aftercareId(99))).toThrow();
    clearAftercarePending(aftercareId(1), marker.token);
    expect(readAftercarePending(aftercareId(1))).toBeUndefined();
  });
  it("redacts references on access removal while keeping the uncertain block", () => {
    markAftercarePending(aftercareId(1), aftercareId(10));
    redactAftercarePending();
    expect(readAftercarePending(aftercareId(1))).toBe("unknown");
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(aftercareId(10));
  });
  it("rejects storage or acting-identity changes before a request can be marked", () => {
    setDraftIdentity(`${aftercareId(2)}:STAFF`);
    expect(() => markAftercarePending(aftercareId(1), aftercareId(10))).toThrow();
    expect(sessionStorage.length).toBe(0);
  });
  it("fails closed when recovery storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("Synthetic unavailable storage");
    });
    expect(() => markAftercarePending(aftercareId(1), aftercareId(10))).toThrow();
  });
});
