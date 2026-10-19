import { expect, it } from "vitest";
import {
  branchBody,
  branchValues,
  branchFormSchema,
  branchQuery,
  branchPageParams,
  parseBranchPage,
  verifyBranchReceipt,
} from "@/lib/admin/work-branches";
const id = "d1000000-0000-4000-8000-000000290000";
const row = {
  id,
  code: "BR-001",
  name: "Synthetic workshop",
  address: "Synthetic address",
  city: "Port Harcourt",
  state: "Rivers State",
  country: "Nigeria",
  timezone: "Africa/Lagos",
  phone: "+2348000000000",
  email: "branch@example.test",
  isActive: true,
  createdAt: "2026-10-18T08:00:00.000Z",
  updatedAt: "2026-10-18T09:00:00.000Z",
};
it("normalizes supported fields and sends only changed values with the inspected revision", () => {
  const values = { ...branchValues(row), code: "br-001", phone: "", email: "" };
  expect(branchBody(values, row)).toEqual({
    phone: null,
    email: null,
    expectedRevision: row.updatedAt,
  });
  expect(branchBody(branchValues(row), row)).toEqual({});
  expect(
    branchFormSchema.safeParse({ ...values, timezone: "Invalid/place" }).success,
  ).toBe(false);
  expect(branchFormSchema.safeParse({ ...values, code: "a" }).success).toBe(false);
  expect(branchFormSchema.safeParse({ ...values, phone: "letters" }).success).toBe(false);
});
it("preserves filters and selection through cursor history while rejecting unsupported combinations", () => {
  const first = branchQuery(new URLSearchParams(`q=workshop&isActive=true&branch=${id}`));
  const next = branchPageParams(first.params, id);
  expect(branchQuery(next).invalid).toBe(false);
  expect(branchPageParams(next, undefined, true).get("branch")).toBe(id);
  for (const query of [
    `branch=${id}&create=1`,
    "isActive=yes",
    "q=a",
    "q=ok&q=other",
    "role=ADMIN",
    "branch=bad",
    "create=true",
  ])
    expect(branchQuery(new URLSearchParams(query)).path).toBeNull();
});
it("rejects wrong branch scope, duplicates and broken pagination receipts", () => {
  expect(
    parseBranchPage({ items: [row] }, new URLSearchParams("q=harcourt&isActive=true"))
      .items,
  ).toHaveLength(1);
  for (const query of ["q=unrelated", "isActive=false", "code=BR-OTHER", `cursor=${id}`])
    expect(() => parseBranchPage({ items: [row] }, new URLSearchParams(query))).toThrow();
  expect(() => parseBranchPage({ items: [row, row] })).toThrow();
  expect(() => parseBranchPage({ items: [], nextCursor: id })).toThrow();
});
it("requires exact changed and unchanged branch facts and an advancing update revision", () => {
  const body = { name: "Changed workshop", expectedRevision: row.updatedAt };
  const saved = { ...row, name: body.name, updatedAt: "2026-10-18T09:00:00.001Z" };
  expect(verifyBranchReceipt(saved, body, row)).toEqual(saved);
  expect(() => verifyBranchReceipt({ ...saved, phone: null }, body, row)).toThrow();
  expect(() =>
    verifyBranchReceipt({ ...saved, updatedAt: row.updatedAt }, body, row),
  ).toThrow();
  expect(() => verifyBranchReceipt({ ...saved, name: row.name }, body, row)).toThrow();
});
