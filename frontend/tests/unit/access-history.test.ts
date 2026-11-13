import { expect, it } from "vitest";
import type { AuditEvent } from "@/lib/api/audit-schemas";
import { accessChangeKind, accessChangeSummary } from "@/lib/admin/access-history";
import { parseWorkAudit } from "@/lib/admin/work-audit";
const id = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const event: AuditEvent = {
  id: id(1),
  userId: id(2),
  user: { role: "ADMIN" },
  action: "UPDATE",
  entityType: "USER",
  entityId: id(3),
  requestId: "synthetic",
  createdAt: "2026-11-13T09:00:00Z",
  oldValues: null,
  newValues: {
    workforceAction: "ASSIGN",
    template: "CUSTOMER_SERVICE",
    templateVersion: 1,
    scope: "BRANCH",
    branchId: id(4),
    temporary: true,
    startsAt: "2026-11-13T09:00:00Z",
    expiresAt: "2026-11-14T09:00:00Z",
    reason: "Recorded synthetic cover",
  },
  currentContext: {
    actor: { id: id(2), name: "Current Operator", role: "ADMIN" },
    subject: { id: id(3), name: "Current Person", role: "STAFF" },
    branches: [{ id: id(4), name: "Current workshop" }],
  },
};
it("explains recorded cover with Lagos dates and explicitly current branch names", () => {
  const summary = accessChangeSummary(event)!;
  expect(summary.title).toBe("Temporary cover added");
  expect(summary.facts).toEqual(
    expect.arrayContaining([
      { label: "Duty", value: "Customer Service Officer" },
      { label: "Branch", value: "Current workshop (current name)" },
    ]),
  );
  expect(summary.facts.find((fact) => fact.label === "Starts")?.value).toContain("10:00");
  expect(summary.facts.find((fact) => fact.label === "Starts")?.value).toContain(
    "Lagos time",
  );
});
it("does not invent missing dates, scope, earlier position or session effects", () => {
  const old = accessChangeSummary({
    ...event,
    newValues: {
      workforceAction: "ASSIGN",
      template: "CUSTOMER_SERVICE",
      templateVersion: 99,
    },
  })!;
  expect(old.facts.find((fact) => fact.label === "Duty")?.value).toContain(
    "definition unavailable",
  );
  for (const label of ["Starts", "Ends", "Where it applies"])
    expect(old.facts.find((fact) => fact.label === label)?.value).toBe(
      "Not recorded in this event",
    );
  const position = accessChangeSummary({
    ...event,
    newValues: {
      workforceAction: "ENROLL_OR_UPDATE_POSITION",
      position: "CUSTOMER_SERVICE",
    },
  })!;
  expect(position.facts.find((fact) => fact.label === "Sessions")?.value).toBe(
    "Not recorded in this event",
  );
  expect(
    accessChangeSummary({ ...event, newValues: { workforceAction: "REVOKE" } })
      ?.explanation,
  ).toContain("Other duties or account-level access may remain");
});
it("keeps recorded account levels distinct from current person metadata and rejects prototype names", () => {
  const row = {
    ...event,
    action: "ROLE_CHANGE" as const,
    oldValues: { role: "CUSTOMER" },
    newValues: { role: "ADMIN" },
  };
  expect(accessChangeSummary(row)?.facts).toEqual([
    { label: "Before", value: "Customer" },
    { label: "After", value: "Administrator" },
  ]);
  expect(row.currentContext!.subject?.role).toBe("STAFF");
  expect(
    accessChangeSummary({ ...row, newValues: { role: "constructor" } })?.facts[1]?.value,
  ).toContain("Unrecognised account level");
});
it("does not classify read, preview, malformed or unsupported operations as access changes", () => {
  expect(accessChangeKind({ ...event, action: "READ" })).toBeUndefined();
  for (const workforceAction of ["ACCESS_PREVIEW", "FUTURE_ACTION", ["ASSIGN"], false])
    expect(
      accessChangeKind({ ...event, newValues: { workforceAction } }),
    ).toBeUndefined();
  expect(
    accessChangeKind({
      ...event,
      entityType: "PRIVILEGED_INVITATION",
      newValues: { revoked: true },
    }),
  ).toBe("INVITATION_CANCELLED");
});
it("requires the scoped projection and refuses contradictory or unexpected current identities", () => {
  const query = { view: "ACCESS_CHANGES" as const };
  expect(parseWorkAudit({ items: [event] }, query).items).toHaveLength(1);
  expect(() => parseWorkAudit({ items: [event] }, {})).toThrow();
  const wrong = [
    { ...event, currentContext: undefined },
    { ...event, action: "READ" },
    {
      ...event,
      currentContext: {
        ...event.currentContext,
        actor: { ...event.currentContext!.actor, id: id(99) },
      },
    },
    {
      ...event,
      currentContext: {
        ...event.currentContext,
        subject: { ...event.currentContext!.subject, id: id(99) },
      },
    },
    {
      ...event,
      currentContext: {
        ...event.currentContext,
        branches: [{ id: id(99), name: "Wrong scope" }],
      },
    },
    {
      ...event,
      currentContext: {
        ...event.currentContext,
        branches: [...event.currentContext!.branches, ...event.currentContext!.branches],
      },
    },
  ];
  for (const row of wrong)
    expect(() => parseWorkAudit({ items: [row] }, query)).toThrow();
});
