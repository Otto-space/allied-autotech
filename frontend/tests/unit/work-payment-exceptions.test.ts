import { describe, expect, it } from "vitest";
import {
  exceptionBodySchema,
  exceptionPageParams,
  exceptionQuery,
  parseCurrentException,
  parseExceptionPage,
  validateExceptionReceipt,
} from "@/lib/admin/work-payment-exceptions";
import { exceptionRow, id } from "../fixtures/work-payment-exceptions";

describe("payment exception workspace boundaries", () => {
  it("keeps supported filters and browser history while excluding UI parameters from the API", () => {
    const q = exceptionQuery(
      new URLSearchParams(`status=OPEN&type=AMOUNT_MISMATCH&selected=${id(210000)}`),
    );
    expect(q.invalid).toBe(false);
    expect(q.path).toBe(
      "/admin/operations/payment-anomalies?status=OPEN&type=AMOUNT_MISMATCH&limit=25",
    );
    const next = exceptionPageParams(q.params, id(210025));
    expect(next.get("selected")).toBe(id(210000));
    expect(next.get("_trail")).toBe("start");
    expect(exceptionPageParams(next, undefined, true).has("cursor")).toBe(false);
    for (const raw of [
      "status=BAD",
      "type=BAD",
      "status=OPEN&status=RESOLVED",
      "selected=bad",
      "search=x",
      `cursor=${id(4)}&_trail=start,${id(4)}`,
      "_trail=start",
    ])
      expect(exceptionQuery(new URLSearchParams(raw)).invalid).toBe(true);
  });
  it("rejects incorrectly scoped, private, impossible or malformed current facts", () => {
    const row = exceptionRow();
    expect(parseCurrentException(row, row.id)).toEqual(row);
    for (const value of [
      { ...row, id: id(9) },
      { ...row, details: { private: true } },
      { ...row, detectedAt: "bad" },
      { ...row, resolvedAt: row.updatedAt },
      { ...row, updatedAt: "2020-01-01T00:00:00.000Z" },
    ])
      expect(() => parseCurrentException(value, row.id)).toThrow();
  });
  it("rejects duplicate, unordered, misfiltered and circular cursor pages", () => {
    const rows = [exceptionRow(), exceptionRow(1)];
    expect(parseExceptionPage({ items: rows }, new URLSearchParams()).items).toHaveLength(
      2,
    );
    for (const items of [[rows[0], rows[0]], [...rows].reverse()])
      expect(() => parseExceptionPage({ items }, new URLSearchParams())).toThrow();
    expect(() =>
      parseExceptionPage({ items: rows }, new URLSearchParams("status=OPEN")),
    ).toThrow();
    expect(() =>
      parseExceptionPage({ items: rows, nextCursor: rows[0].id }, new URLSearchParams()),
    ).toThrow();
  });
  it("binds transition receipts to original source facts, note, target state and closing actor", () => {
    const before = exceptionRow(),
      body = exceptionBodySchema.parse({
        expectedStatus: "OPEN",
        status: "INVESTIGATING",
        resolutionNote: "Checked exact source.",
      }),
      row = {
        ...before,
        status: "INVESTIGATING",
        resolutionNote: body.resolutionNote,
        updatedAt: "2026-10-18T10:00:00.000Z",
      };
    expect(validateExceptionReceipt(row, before, body, id(302)).status).toBe(
      "INVESTIGATING",
    );
    for (const value of [
      { ...row, id: id(8) },
      { ...row, resolutionNote: "Other note" },
      { ...row, paymentId: id(8) },
      { ...row, summary: "Other source" },
      { ...row, status: "OPEN" },
    ])
      expect(() => validateExceptionReceipt(value, before, body, id(302))).toThrow();
    expect(() => exceptionBodySchema.parse({ ...body, status: "RESOLVED" })).toThrow();
    const closing = {
        expectedStatus: "INVESTIGATING",
        status: "RESOLVED",
        resolutionNote: "Reconciled independently.",
      } as const,
      final = {
        ...row,
        status: "RESOLVED",
        resolutionNote: closing.resolutionNote,
        resolvedAt: "2026-10-18T11:00:00.000Z",
        updatedAt: "2026-10-18T11:00:00.000Z",
        resolvedByUserId: id(302),
      };
    expect(
      validateExceptionReceipt(
        final,
        { ...before, status: "INVESTIGATING" },
        closing,
        id(302),
      ).status,
    ).toBe("RESOLVED");
    expect(() =>
      validateExceptionReceipt(
        { ...final, resolvedByUserId: id(8) },
        { ...before, status: "INVESTIGATING" },
        closing,
        id(302),
      ),
    ).toThrow();
  });
});
