import { expect, it } from "vitest";
import {
  workforceFinanceQuery,
  financeHref,
  parseScopedWorkforceFinance,
  parseWorkforcePayment,
  workforcePaymentAmount,
} from "../../lib/admin/workforce-finance";
const id = (n: number) => `be000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  stamp = "2026-10-20T09:00:00.000Z";
function data() {
  return {
    id: id(10),
    paymentNumber: "PAY-110",
    amountKobo: "2750050",
    currency: "NGN",
    status: "SUCCEEDED",
    purpose: "ORDER_PAYMENT",
    createdAt: stamp,
    updatedAt: stamp,
    succeededAt: stamp,
    expiresAt: null,
    cancelledAt: null,
    expiredAt: null,
    generatedAt: stamp,
    sources: [
      { kind: "ORDER", reference: "AA-110", branch: { id: id(4), name: "Stadium Road" } },
    ],
    access: {
      managed: true,
      userId: id(1),
      staffId: id(2),
      position: "Accountant",
      department: "Accounts",
      version: 1,
      permissions: ["FINANCE_READ"],
      canManageAssignments: false,
      canInviteAdmins: false,
      serverTime: stamp,
      assignments: [
        {
          id: id(3),
          userId: id(1),
          branchId: id(4),
          template: "ACCOUNTANT",
          scope: "BRANCH",
          temporary: false,
          startsAt: stamp,
          expiresAt: null as string | null,
          reason: "Synthetic assignment",
          assignedByUserId: id(5),
          createdAt: stamp,
          revokedAt: null as string | null,
          revokedByUserId: null,
          revocationReason: null,
        },
      ],
    },
  };
}
it("keeps selection and trail out of API queries while preserving navigation", () => {
  const q = workforceFinanceQuery(
    new URLSearchParams({
      q: " INV %_ ",
      status: "PROCESSING",
      purpose: "SERVICE_INVOICE",
      selected: id(10),
      cursor: id(20),
      _trail: "start",
    }),
  );
  expect(q.invalid).toBe(false);
  expect(q.path).toContain("q=INV+%25_");
  expect(q.path).not.toMatch(/selected|trail/);
  expect(financeHref(q.params)).toContain("selected=");
});
it("rejects malformed, duplicate, unsupported and control-character query values", () => {
  for (const q of [
    "status=constructor",
    "purpose=OTHER",
    "q=a&q=b",
    "selected=bad",
    "cursor=bad",
    "_trail=start",
    "q=x%00",
    "q=" + "x".repeat(121),
    "branchId=" + id(4),
  ])
    expect(workforceFinanceQuery(new URLSearchParams(q)).path).toBeNull();
});
it("preserves integer precision and currency in payment amounts", () => {
  expect(workforcePaymentAmount("900719925474099101", "NGN")).toBe(
    "NGN 9,007,199,254,740,991.01",
  );
  expect(workforcePaymentAmount("0", "USD")).toBe("USD 0.00");
  expect(workforcePaymentAmount("5", "NGN")).toBe("NGN 0.05");
});
it("requires current Accountant scope for every returned source", () => {
  for (const mutate of [
    (r: ReturnType<typeof data>) => {
      r.sources[0].branch.id = id(99);
    },
    (r: ReturnType<typeof data>) => {
      r.access.assignments[0].template = "OPERATIONS";
    },
    (r: ReturnType<typeof data>) => {
      r.access.assignments[0].userId = id(99);
    },
    (r: ReturnType<typeof data>) => {
      r.access.assignments[0].expiresAt = stamp;
    },
    (r: ReturnType<typeof data>) => {
      r.access.assignments[0].revokedAt = stamp;
    },
    (r: ReturnType<typeof data>) => {
      r.access.permissions = [];
    },
  ]) {
    const r = data();
    mutate(r);
    expect(() => parseWorkforcePayment(r)).toThrow();
  }
  expect(parseWorkforcePayment(data()).paymentNumber).toBe("PAY-110");
});
it("rejects malformed money, unknown statuses and missing source context", () => {
  for (const amountKobo of ["1.2", "-1", "NaN", "1".repeat(20)])
    expect(() => parseWorkforcePayment({ ...data(), amountKobo })).toThrow();
  expect(() => parseWorkforcePayment({ ...data(), status: "PAID" })).toThrow();
  expect(() => parseWorkforcePayment({ ...data(), sources: [] })).toThrow();
});
it("rejects duplicate records and incorrect pagination receipts", () => {
  const r = data(),
    page = { items: [r], access: r.access, generatedAt: stamp };
  expect(parseScopedWorkforceFinance(page).items).toHaveLength(1);
  expect(() => parseScopedWorkforceFinance({ ...page, items: [r, r] })).toThrow();
  expect(() => parseScopedWorkforceFinance({ ...page, nextCursor: r.id })).toThrow();
});
